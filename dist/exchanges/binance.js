"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Binance = void 0;
const axios_1 = require("axios");
const crypto = require("crypto");
const constants_1 = require("../constants/constants");
class Binance {
    constructor(apiKey, apiSecret, baseUrl) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = baseUrl;
    }
    createSignature(params) {
        const queryString = Object.entries(params)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }
    async isOrderCanceled(response) {
        if (response && response.status === 'CANCELED') {
            console.log(`\nOrder Cancelled:`, JSON.stringify(response));
            return true;
        }
        return false;
    }
    async placeOrder(symbol, side, quantity) {
        var _a, _b;
        const type = 'LIMIT';
        const timeInForce = 'GTC';
        const endpoint = '/fapi/v1/order';
        const timestamp = Date.now();
        const params = {
            symbol,
            side,
            type,
            timeInForce,
            quantity,
            timestamp,
            PriceMatch: 'QUEUE',
            recvWindow: constants_1.API_CONFIG.recvWindow,
        };
        params['signature'] = this.createSignature(params);
        const url = `${this.baseUrl}${endpoint}`;
        const headers = { 'X-MBX-APIKEY': this.apiKey };
        try {
            const response = await axios_1.default.post(url, null, { headers, params });
            console.log('\nOrder placed on Binance:', JSON.stringify(response.data));
            return ((_a = response.data) === null || _a === void 0 ? void 0 : _a.clientOrderId) || null;
        }
        catch (error) {
            console.error('\nError placing order on Binance:', ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            return null;
        }
    }
    async getOrderStatus(ordId, symbol) {
        var _a, _b, _c;
        const endpoint = '/fapi/v1/order';
        const timestamp = Date.now();
        const params = {
            symbol,
            origClientOrderId: ordId,
            timestamp,
            recvWindow: constants_1.API_CONFIG.recvWindow,
        };
        params['signature'] = this.createSignature(params);
        const url = `${this.baseUrl}${endpoint}`;
        const headers = { 'X-MBX-APIKEY': this.apiKey };
        try {
            const response = await axios_1.default.get(url, { headers, params });
            console.log('\nOrder status on Binance:', (_a = response.data) === null || _a === void 0 ? void 0 : _a.status);
            return ((_b = response.data) === null || _b === void 0 ? void 0 : _b.status) || null;
        }
        catch (error) {
            console.error('\nError fetching order status:', ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) || error.message);
            return null;
        }
    }
    async cancelOrder(ordId, symbol) {
        var _a;
        const endpoint = '/fapi/v1/order';
        const timestamp = Date.now();
        const params = {
            symbol,
            origClientOrderId: ordId,
            timestamp,
            recvWindow: constants_1.API_CONFIG.recvWindow,
        };
        params['signature'] = this.createSignature(params);
        const url = `${this.baseUrl}${endpoint}`;
        const headers = { 'X-MBX-APIKEY': this.apiKey };
        try {
            const response = await axios_1.default.delete(url, { headers, params });
            console.log('\nOrder cancelled on Binance:', JSON.stringify(response.data));
            return response.data;
        }
        catch (error) {
            console.error('\nError cancelling order on Binance:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return null;
        }
    }
}
exports.Binance = Binance;
//# sourceMappingURL=binance.js.map