import axios from 'axios';
import * as crypto from 'crypto';
import { WebSocket } from 'ws';
import { API_CONFIG } from '../constants/constants';

export class Bybit {
  private manualClose: boolean = false;
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private wsurl: string;
  private ws: WebSocket | null = null;
  private bestBid: { price: number; timestamp: number } | null = null;
  private bestAsk: { price: number; timestamp: number } | null = null;

  constructor(
    bybitApiKey: string,
    bybitApiSecret: string,
    bybitBaseUrl: string,
    bybitWsUrl: string,
  ) {
    this.apiKey = bybitApiKey;
    this.apiSecret = bybitApiSecret;
    this.baseUrl = bybitBaseUrl;
    this.wsurl = bybitWsUrl;
  }

  private createSignature(params: Record<string, string | number>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(sortedParams)
      .digest('hex');
  }

  async connectWebSocket(symbol: string): Promise<void> {
    const wsUrl = this.wsurl;
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log(`Connected to WebSocket for ${symbol}`);
      this.ws?.send(
        JSON.stringify({ op: 'subscribe', args: [`orderbook.1.${symbol}`] }),
      );
    });

    this.ws.on('message', (data) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.topic === `orderbook.1.${symbol}` && parsed.data) {
        const updates = parsed.data;
        if (updates.b?.length) {
          this.bestBid = {
            price: parseFloat(updates.b[0][0]),
            timestamp: parsed.ts,
          };
        }
        if (updates.a?.length) {
          this.bestAsk = {
            price: parseFloat(updates.a[0][0]),
            timestamp: parsed.ts,
          };
        }
      }
    });

    this.ws.on('close', () => {
      console.log('WebSocket connection closed.');
      if (!this.manualClose) {
        console.log('Reconnecting...');
        setTimeout(() => {
          this.connectWebSocket(symbol); // Reconnect after 5 seconds
        }, 5000);
      } else {
        console.log('Manual close detected. Not reconnecting.');
        this.manualClose = false; // Reset the flag after manual close
      }
    });

    this.ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  }

  public closeWebSocket(): void {
    if (this.ws) {
      console.log('Closing WebSocket connection...');
      this.manualClose = true; // Set the flag before closing
      this.ws.close(); // Close the WebSocket connection
      this.ws = null;
    } else {
      console.log('WebSocket is not open.');
    }
  }

  async getBestBidAndAsk(symbol: string): Promise<[number, number] | null> {
    const now = Date.now();

    if (
      this.bestBid &&
      this.bestAsk &&
      now - this.bestBid.timestamp <= 5000 &&
      now - this.bestAsk.timestamp <= 5000
    ) {
      return [this.bestBid.price, this.bestAsk.price];
    }

    console.log(
      'WebSocket data is stale or unavailable. Fetching order book from API...',
    );

    const url = `${this.baseUrl}/v5/market/orderbook`;
    try {
      const { data } = await axios.get(url, {
        params: { category: 'linear', symbol },
      });
      if (data.retCode === 0) {
        const bestBid = parseFloat(data.result.b[0][0]);
        const bestAsk = parseFloat(data.result.a[0][0]);
        const timestamp = now;
        this.bestBid = { price: bestBid, timestamp };
        this.bestAsk = { price: bestAsk, timestamp };
        return [bestBid, bestAsk];
      }
    } catch (error) {
      console.error('Error fetching order book from API:', error);
    }

    console.error('Failed to retrieve best bid and ask prices.');
    return null;
  }

  async placeLimitOrder(
    symbol: string,
    side: 'Buy' | 'Sell',
    qty: number,
    pricePrecision: number,
  ): Promise<any | null> {
    try {
      const bestPrices = await this.getBestBidAndAsk(symbol);
      if (!bestPrices) {
        throw new Error('Unable to fetch best bid/ask for placing order');
      }

      const price = side === 'Buy' ? bestPrices[0] : bestPrices[1];
      const roundedPrice = Math.round(price / pricePrecision) * pricePrecision;

      const endpoint = '/v5/order/create';
      const url = `${this.baseUrl}${endpoint}`;
      const timestamp = Date.now();
      const params = {
        api_key: this.apiKey,
        symbol,
        qty: qty.toString(),
        side,
        orderType: 'Limit',
        price: roundedPrice.toString(),
        category: 'linear',
        timestamp,
        timeInForce: 'PostOnly',
        recvWindow: API_CONFIG.recvWindow,
      };
      params['sign'] = this.createSignature(params);

      const response = await axios.post(url, params);
      return response.data;
    } catch (error) {
      console.error('Error placing limit order:', error);
      return error.response?.data || error.message;
    }
  }

  async getPricePrecision(symbol: string): Promise<number | null> {
    console.log(`Fetching price precision for symbol: ${symbol}...`);
    const url = `${this.baseUrl}/v5/market/instruments-info`;
    const params = {
      category: 'linear',
      symbol,
    };

    try {
      const response = await axios.get(url, { params });
      const data = response.data;

      if (data.retCode === 0) {
        const instrumentInfo = data.result.list[0];
        const tickSize = parseFloat(instrumentInfo.priceFilter.tickSize);
        console.log(`Tick Size (Price Precision): ${tickSize}\n`);
        return tickSize;
      } else {
        throw new Error(`Error fetching instrument info: ${data.retMsg}`);
      }
    } catch (error) {
      console.error(`Error in getPricePrecision: ${error}`);
      return null;
    }
  }

  async fetchOrderStatus(orderId: string, symbol: string): Promise<any | null> {
    console.log(`Fetching status for Order ID: ${orderId}...`);
    const endpoint = '/v5/order/realtime';
    const url = `${this.baseUrl}${endpoint}`;
    const timestamp = Date.now();

    const params = {
      api_key: this.apiKey,
      category: 'linear',
      symbol,
      orderId,
      timestamp,
      recvWindow: API_CONFIG.recvWindow,
    };
    params['sign'] = this.createSignature(params);

    try {
      const response = await axios.get(url, { params });
      const orderStatus = response.data;

      if (orderStatus.retCode === 0) {
        const extractedStatus = orderStatus.result.list?.[0]?.orderStatus;
        if (extractedStatus) {
          console.log(`Order Status: ${extractedStatus}`);
          return extractedStatus;
        }
      } else {
        throw new Error(`Error fetching order status: ${orderStatus.retMsg}`);
      }
    } catch (error) {
      console.error(`Error in fetchOrderStatus: ${error}`);
      return null;
    }
  }
  // cancelling an existing order
  async cancelOrder(orderId: string, symbol: string): Promise<any | null> {
    console.log(`Cancelling Order ID: ${orderId}...`);
    const endpoint = '/v5/order/cancel';
    const url = `${this.baseUrl}${endpoint}`;
    const timestamp = Date.now();

    const params = {
      api_key: this.apiKey,
      category: 'linear',
      symbol,
      orderId,
      timestamp,
      recvWindow: API_CONFIG.recvWindow,
    };
    params['sign'] = this.createSignature(params);

    try {
      const response = await axios.post(url, params);
      const cancelResponse = response.data;

      if (cancelResponse.retCode === 0) {
        console.log(
          `Order Canceled Successfully: ${JSON.stringify(cancelResponse.result, null, 4)}\n`,
        );
        return cancelResponse.result;
      } else {
        throw new Error(`Error canceling order: ${cancelResponse.retMsg}`);
      }
    } catch (error) {
      console.error(`Error in cancelOrder: ${error}`);
      return null;
    }
  }
  //fetching an open position
  async getOpenPositions(
    category = 'linear',
    symbol?: string,
  ): Promise<number | null> {
    console.log(
      `Fetching open positions${symbol ? ` for ${symbol}` : ''} at ByBit...`,
    );
    const endpoint = '/v5/position/list';
    const url = `${this.baseUrl}${endpoint}`;
    const timestamp = Date.now();

    const params: Record<string, string | number> = {
      api_key: this.apiKey,
      category,
      timestamp,
      recvWindow: API_CONFIG.recvWindow,
    };
    if (symbol) {
      params['symbol'] = symbol;
    }
    params['sign'] = this.createSignature(params);

    try {
      const response = await axios.get(url, { params });
      const data = response.data;

      if (data.retCode === 0) {
        const positions = data.result?.list || [];
        let totalSize = 0;

        positions.forEach((position: any) => {
          console.log(
            `Position: ${position.symbol}, Size: ${position.size}, Side: ${position.side}`,
          );
          totalSize += parseFloat(position.size);
        });

        console.log(
          `\nTotal Open Position Size for ${symbol || 'all symbols'}: ${totalSize}\n`,
        );
        return totalSize;
      } else {
        throw new Error(`Error fetching positions: ${data.retMsg}`);
      }
    } catch (error) {
      console.error(`[ERROR] Failed to fetch positions from Bybit: ${error}`);
      return null;
    }
  }
}
