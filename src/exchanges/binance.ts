import axios from 'axios';
import * as crypto from 'crypto';
import { API_CONFIG } from '../constants/constants';

export class Binance {
  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly baseUrl: string,
  ) {}

  private createSignature(params: Record<string, string | number>): string {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  async fetchOrderStatusBinance(
    clientOrderId: string,
    symbol: string,
  ): Promise<any | null> {
    console.log(
      `Fetching order status for Order ID: ${clientOrderId}, Symbol: ${symbol} at Binance...\n`,
    );
    const endpoint = '/fapi/v1/order';
    const timestamp = Date.now();

    const params = {
      symbol,
      origClientOrderId: clientOrderId,
      timestamp,
      recvWindow: API_CONFIG.recvWindow,
    };
    params['signature'] = this.createSignature(params);

    const url = `${this.baseUrl}${endpoint}`;
    const headers = { 'X-MBX-APIKEY': this.apiKey };

    try {
      const response = await axios.get(url, { headers, params });
      const status = response.data?.status;
      console.log(`Order Status: ${status}`);
      if (status) {
        return status;
      }
    } catch (error: any) {
      console.error(`Error fetching Binance order status: ${error}`);
      if (error.response) {
        console.error('Response Content:', error.response.data);
      }
      return null;
    }
  }

  async getOpenPositionsBinance(symbol?: string): Promise<number | null> {
    console.log(
      `Fetching open positions for ${symbol || 'all symbols'}...at Binance\n`,
    );
    const endpoint = '/fapi/v2/positionRisk';
    const timestamp = Date.now();

    const params: Record<string, any> = {
      timestamp,
      recvWindow: API_CONFIG.recvWindow,
    };
    if (symbol) {
      params['symbol'] = symbol;
    }
    params['signature'] = this.createSignature(params);

    const url = `${this.baseUrl}${endpoint}`;
    const headers = { 'X-MBX-APIKEY': this.apiKey };

    try {
      const response = await axios.get(url, { headers, params });
      const positions = response.data;

      const openPositions = positions.filter(
        (p: any) => parseFloat(p.positionAmt) !== 0,
      );
      if (symbol) {
        console.log(
          `Raw Positions Response: ${JSON.stringify(positions, null, 4)}`,
        );
      }

      openPositions.forEach((pos: any) =>
        console.log(
          `Position: Symbol=${pos.symbol}, Amount=${pos.positionAmt}, EntryPrice=${pos.entryPrice}`,
        ),
      );

      const positionAmount = openPositions.reduce(
        (acc: number, pos: any) => acc + Math.abs(parseFloat(pos.positionAmt)),
        0,
      );

      console.log(
        `\nOpen Position Amount for ${symbol || 'all symbols'}: ${positionAmount}\n`,
      );
      return positionAmount;
    } catch (error: any) {
      console.error(`Error fetching Binance open positions: ${error}`);
      if (error.response) {
        console.error('Response Content:', error.response.data);
      }
      return null;
    }
  }

  async cancelOrderBinance(
    clientOrderId: string,
    symbol: string,
  ): Promise<any | null> {
    console.log(
      `Cancelling order with ID: ${clientOrderId}, Symbol: ${symbol}...\n`,
    );
    const endpoint = '/fapi/v1/order';
    const timestamp = Date.now();

    const params = {
      symbol,
      origClientOrderId: clientOrderId,
      timestamp,
      recvWindow: API_CONFIG.recvWindow,
    };
    params['signature'] = this.createSignature(params);

    const url = `${this.baseUrl}${endpoint}`;
    const headers = { 'X-MBX-APIKEY': this.apiKey };

    try {
      const response = await axios.delete(url, { headers, params });
      console.log(
        `Order Cancelled: ${JSON.stringify(response.data, null, 4)}\n`,
      );
      return response.data;
    } catch (error: any) {
      console.error(`Error canceling Binance order: ${error}`);
      if (error.response) {
        console.error('Response Content:', error.response.data);
      }
      return null;
    }
  }

  async placeOrderBinance(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
  ): Promise<any | null> {
    console.log(
      `Placing a ${side} LIMIT order for ${symbol} with quantity ${quantity}...\n`,
    );
    const endpoint = '/fapi/v1/order';
    const timestamp = Date.now();

    const params = {
      symbol,
      side,
      type: 'LIMIT',
      timeInForce: 'GTC',
      quantity,
      timestamp,
      PriceMatch: 'QUEUE',
      recvWindow: API_CONFIG.recvWindow,
    };
    params['signature'] = this.createSignature(params);

    const url = `${this.baseUrl}${endpoint}`;
    const headers = { 'X-MBX-APIKEY': this.apiKey };

    try {
      const response = await axios.post(url, null, { headers, params });
      console.log('-'.repeat(40));
      console.log(
        `[Order Submitted - ${side}]:\n${JSON.stringify(response.data, null, 4)}`,
      );
      console.log('-'.repeat(40));
      return response.data;
    } catch (error: any) {
      console.error(`Error placing order for ${symbol}: ${error}`);
      if (error.response) {
        console.error('Response Content:', error.response.data);
      }
      return error.response.data;
    }
  }
}
