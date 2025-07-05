"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bybit = void 0;
const axios_1 = require("axios");
const crypto = require("crypto");
const constants_1 = require("../constants/constants");
class Bybit {
    constructor(bybitApiKey, bybitApiSecret, bybitBaseUrl) {
        this.apiKey = bybitApiKey;
        this.apiSecret = bybitApiSecret;
        this.baseUrl = bybitBaseUrl;
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
    async getOrderBook(symbol) {
        console.log(`Fetching order book for symbol: ${symbol}...`);
        const url = `${this.baseUrl}/v5/market/orderbook`;
        const params = {
            category: 'linear',
            symbol,
        };
        try {
            const response = await axios_1.default.get(url, { params });
            const data = response.data;
            if (data.retCode === 0) {
                const orderBook = data.result;
                const bestBid = parseFloat(orderBook.b[0][0]);
                const bestAsk = parseFloat(orderBook.a[0][0]);
                console.log(`Best Bid: ${bestBid}, Best Ask: ${bestAsk}\n`);
                return [bestBid, bestAsk];
            }
            else {
                throw new Error(`Error fetching order book: ${data.retMsg}`);
            }
        }
        catch (error) {
            console.error(`Error in getOrderBook: ${error}`);
            return null;
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
    async placeLimitOrder(symbol, side, qty, pricePrecision) {
        try {
            console.log(`Placing a ${side.toUpperCase()} limit order for ${symbol} with quantity ${qty}...`);
            const orderBook = await this.getOrderBook(symbol);
            if (!orderBook) {
                throw new Error('Unable to fetch order book prices');
            }
            const [bestBid, bestAsk] = orderBook;
            const price = side === 'Buy' ? bestBid : bestAsk;
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
            console.log(`Order Response: ${JSON.stringify(response.data, null, 4)}\n`);
            return response.data;
        }
        catch (error) {
            console.error(`Error placing limit order: ${error}`);
            return error.response.data;
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
//# sourceMappingURL=bybittemp.js.map