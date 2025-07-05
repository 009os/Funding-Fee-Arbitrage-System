"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bybit = void 0;
const axios_1 = require("axios");
const crypto = require("crypto");
const ws_1 = require("ws");
const constants_1 = require("../constants/constants");
class Bybit {
    constructor(bybitApiKey, bybitApiSecret, bybitBaseUrl, bybitWsUrl) {
        this.ws = null;
        this.manualClose = false;
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
    async isOrderCanceled(response) {
        if (response && response.orderId) {
            console.log(`\nOrder Canceled Successfully:`, response);
            return true;
        }
        return false;
    }
    async placeOrder(symbol, side, quantity, precision) {
        var _a, _b;
        let orgside;
        if (side === 'BUY') {
            orgside = 'Buy';
        }
        else if (side === 'SELL') {
            orgside = 'Sell';
        }
        try {
            const bestPrices = await this.getBestBidAndAsk(symbol);
            if (!bestPrices) {
                throw new Error('\nUnable to fetch best bid/ask for placing order');
            }
            const price = orgside === 'Buy' ? bestPrices[0] : bestPrices[1];
            const roundedPrice = Math.round(price / precision) * precision;
            const endpoint = '/v5/order/create';
            const url = `${this.baseUrl}${endpoint}`;
            const timestamp = Date.now();
            const params = {
                api_key: this.apiKey,
                symbol,
                qty: quantity.toString(),
                side: orgside,
                orderType: 'Limit',
                price: roundedPrice.toString(),
                category: 'linear',
                timestamp,
                timeInForce: 'PostOnly',
                recvWindow: constants_1.API_CONFIG.recvWindow,
            };
            params['sign'] = this.createSignature(params);
            const response = await axios_1.default.post(url, params);
            console.log('\nOrder placed on Bybit:', JSON.stringify(response.data));
            return ((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.result) === null || _b === void 0 ? void 0 : _b.orderId) || null;
        }
        catch (error) {
            console.error('\nError placing limit order:', error);
            return null;
        }
    }
    async getOrderStatus(ordId, symbol) {
        var _a, _b;
        const endpoint = '/v5/order/realtime';
        const url = `${this.baseUrl}${endpoint}`;
        const timestamp = Date.now();
        const params = {
            api_key: this.apiKey,
            category: 'linear',
            symbol,
            orderId: ordId,
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
                    console.log(`\nOrder Status on Bybit: ${extractedStatus}`);
                    return extractedStatus;
                }
            }
            else {
                throw new Error(`\nError fetching order status: ${orderStatus.retMsg}`);
            }
        }
        catch (error) {
            console.error(`\nError in fetchOrderStatus: ${error}`);
            return null;
        }
    }
    async cancelOrder(ordId, symbol) {
        const endpoint = '/v5/order/cancel';
        const url = `${this.baseUrl}${endpoint}`;
        const timestamp = Date.now();
        const params = {
            api_key: this.apiKey,
            category: 'linear',
            symbol,
            orderId: ordId,
            timestamp,
            recvWindow: constants_1.API_CONFIG.recvWindow,
        };
        params['sign'] = this.createSignature(params);
        try {
            const response = await axios_1.default.post(url, params);
            const cancelResponse = response.data;
            if (cancelResponse.retCode === 0) {
                console.log(`Order Canceled on bybit: ${JSON.stringify(cancelResponse.result, null)}\n`);
                return cancelResponse.result;
            }
            else {
                throw new Error(`\nError canceling order: ${cancelResponse.retMsg}`);
            }
        }
        catch (error) {
            console.error(`\nError in cancelOrder: ${error}`);
            return null;
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
        console.log('\nFetching order book from API as WebSocket data is stale...');
        const url = `${this.baseUrl}/v5/market/orderbook`;
        try {
            const { data } = await axios_1.default.get(url, {
                params: { category: 'linear', symbol },
            });
            if (data.retCode === 0) {
                const bestBid = parseFloat(data.result.b[0][0]);
                const bestAsk = parseFloat(data.result.a[0][0]);
                this.bestBid = { price: bestBid, timestamp: now };
                this.bestAsk = { price: bestAsk, timestamp: now };
                return [bestBid, bestAsk];
            }
        }
        catch (error) {
            console.error('\nError fetching order book on Bybit:', error);
        }
        return null;
    }
    async connectWebSocket(symbol) {
        const wsUrl = this.wsurl;
        this.ws = new ws_1.WebSocket(wsUrl);
        this.ws.on('open', () => {
            var _a;
            console.log(`\nConnected to WebSocket for ${symbol}`);
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
            console.log('\nWebSocket connection closed.');
            if (!this.manualClose) {
                console.log('\nReconnecting...');
                setTimeout(() => this.connectWebSocket(symbol), 5000);
            }
            else {
                console.log('\nManual close detected. Not reconnecting.');
                this.manualClose = false;
            }
        });
        this.ws.on('error', (err) => {
            console.error('\nWebSocket error:', err);
        });
    }
    closeWebSocket() {
        if (this.ws) {
            console.log('\nClosing WebSocket connection...');
            this.manualClose = true;
            this.ws.close();
            this.ws = null;
        }
        else {
            console.log('\nWebSocket is not open.');
        }
    }
    async getPricePrecision(symbol) {
        console.log(`\nFetching price precision for symbol: ${symbol}...`);
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
                console.log(`\nTick Size (Price Precision): ${tickSize}\n`);
                return tickSize;
            }
            else {
                throw new Error(`\nError fetching instrument info: ${data.retMsg}`);
            }
        }
        catch (error) {
            console.error(`\nError in getPricePrecision: ${error}`);
            return null;
        }
    }
}
exports.Bybit = Bybit;
//# sourceMappingURL=bybit.js.map