"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bybit = void 0;
const axios_1 = require("axios");
const crypto = require("crypto");
const ws_1 = require("ws");
const constants_1 = require("../constants/constants");
class Bybit {
    constructor(bybitApiKey, bybitApiSecret, bybitBaseUrl, bybitWsUrl) {
        this.manualClose = false;
        this.ws = null;
        this.bestBid = null;
        this.bestAsk = null;
        this.apiKey = bybitApiKey;
        this.apiSecret = bybitApiSecret;
        this.baseUrl = bybitBaseUrl;
        this.wsurl = bybitWsUrl;
    }
    createSignature(params) {
        const sortedParams = Object.keys(params)
            .sort()
            .map((key) => `${key}=${params[key]}`)
            .join('&');
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(sortedParams)
            .digest('hex');
    }
    async connectWebSocket(symbol) {
        const wsUrl = this.wsurl;
        this.ws = new ws_1.WebSocket(wsUrl);
        this.ws.on('open', () => {
            var _a;
            console.log(`Connected to WebSocket for ${symbol}`);
            (_a = this.ws) === null || _a === void 0 ? void 0 : _a.send(JSON.stringify({ op: 'subscribe', args: [`orderbook.1.${symbol}`] }));
        });
        this.ws.on('message', (data) => {
            var _a, _b;
            const parsed = JSON.parse(data.toString());
            if (parsed.topic === `orderbook.1.${symbol}` && parsed.data) {
                const updates = parsed.data;
                if ((_a = updates.b) === null || _a === void 0 ? void 0 : _a.length) {
                    this.bestBid = {
                        price: parseFloat(updates.b[0][0]),
                        timestamp: parsed.ts,
                    };
                }
                if ((_b = updates.a) === null || _b === void 0 ? void 0 : _b.length) {
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
                    this.connectWebSocket(symbol);
                }, 5000);
            }
            else {
                console.log('Manual close detected. Not reconnecting.');
                this.manualClose = false;
            }
        });
        this.ws.on('error', (err) => {
            console.error('WebSocket error:', err);
        });
    }
    closeWebSocket() {
        if (this.ws) {
            console.log('Closing WebSocket connection...');
            this.manualClose = true;
            this.ws.close();
            this.ws = null;
        }
        else {
            console.log('WebSocket is not open.');
        }
    }
    async getBestBidAndAsk(symbol) {
        const now = Date.now();
        if (this.bestBid &&
            this.bestAsk &&
            now - this.bestBid.timestamp <= 5000 &&
            now - this.bestAsk.timestamp <= 5000) {
            return [this.bestBid.price, this.bestAsk.price];
        }
        console.log('WebSocket data is stale or unavailable. Fetching order book from API...');
        const url = `${this.baseUrl}/v5/market/orderbook`;
        try {
            const { data } = await axios_1.default.get(url, {
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
        }
        catch (error) {
            console.error('Error fetching order book from API:', error);
        }
        console.error('Failed to retrieve best bid and ask prices.');
        return null;
    }
    async placeLimitOrder(symbol, side, qty, pricePrecision) {
        var _a;
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
                recvWindow: constants_1.API_CONFIG.recvWindow,
            };
            params['sign'] = this.createSignature(params);
            const response = await axios_1.default.post(url, params);
            return response.data;
        }
        catch (error) {
            console.error('Error placing limit order:', error);
            return ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message;
        }
    }
    async getPricePrecision(symbol) {
        console.log(`Fetching price precision for symbol: ${symbol}...`);
        const url = `${this.baseUrl}/v5/market/instruments-info`;
        const params = {
            category: 'linear',
            symbol,
        };
        try {
            const response = await axios_1.default.get(url, { params });
            const data = response.data;
            if (data.retCode === 0) {
                const instrumentInfo = data.result.list[0];
                const tickSize = parseFloat(instrumentInfo.priceFilter.tickSize);
                console.log(`Tick Size (Price Precision): ${tickSize}\n`);
                return tickSize;
            }
            else {
                throw new Error(`Error fetching instrument info: ${data.retMsg}`);
            }
        }
        catch (error) {
            console.error(`Error in getPricePrecision: ${error}`);
            return null;
        }
    }
    async fetchOrderStatus(orderId, symbol) {
        var _a, _b;
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
            recvWindow: constants_1.API_CONFIG.recvWindow,
        };
        params['sign'] = this.createSignature(params);
        try {
            const response = await axios_1.default.get(url, { params });
            const orderStatus = response.data;
            if (orderStatus.retCode === 0) {
                const extractedStatus = (_b = (_a = orderStatus.result.list) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.orderStatus;
                if (extractedStatus) {
                    console.log(`Order Status: ${extractedStatus}`);
                    return extractedStatus;
                }
            }
            else {
                throw new Error(`Error fetching order status: ${orderStatus.retMsg}`);
            }
        }
        catch (error) {
            console.error(`Error in fetchOrderStatus: ${error}`);
            return null;
        }
    }
    async cancelOrder(orderId, symbol) {
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
            recvWindow: constants_1.API_CONFIG.recvWindow,
        };
        params['sign'] = this.createSignature(params);
        try {
            const response = await axios_1.default.post(url, params);
            const cancelResponse = response.data;
            if (cancelResponse.retCode === 0) {
                console.log(`Order Canceled Successfully: ${JSON.stringify(cancelResponse.result, null, 4)}\n`);
                return cancelResponse.result;
            }
            else {
                throw new Error(`Error canceling order: ${cancelResponse.retMsg}`);
            }
        }
        catch (error) {
            console.error(`Error in cancelOrder: ${error}`);
            return null;
        }
    }
    async getOpenPositions(category = 'linear', symbol) {
        var _a;
        console.log(`Fetching open positions${symbol ? ` for ${symbol}` : ''} at ByBit...`);
        const endpoint = '/v5/position/list';
        const url = `${this.baseUrl}${endpoint}`;
        const timestamp = Date.now();
        const params = {
            api_key: this.apiKey,
            category,
            timestamp,
            recvWindow: constants_1.API_CONFIG.recvWindow,
        };
        if (symbol) {
            params['symbol'] = symbol;
        }
        params['sign'] = this.createSignature(params);
        try {
            const response = await axios_1.default.get(url, { params });
            const data = response.data;
            if (data.retCode === 0) {
                const positions = ((_a = data.result) === null || _a === void 0 ? void 0 : _a.list) || [];
                let totalSize = 0;
                positions.forEach((position) => {
                    console.log(`Position: ${position.symbol}, Size: ${position.size}, Side: ${position.side}`);
                    totalSize += parseFloat(position.size);
                });
                console.log(`\nTotal Open Position Size for ${symbol || 'all symbols'}: ${totalSize}\n`);
                return totalSize;
            }
            else {
                throw new Error(`Error fetching positions: ${data.retMsg}`);
            }
        }
        catch (error) {
            console.error(`[ERROR] Failed to fetch positions from Bybit: ${error}`);
            return null;
        }
    }
}
exports.Bybit = Bybit;
//# sourceMappingURL=bybit1.js.map