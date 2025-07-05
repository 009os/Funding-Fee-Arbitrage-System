"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Okx = void 0;
const axios_1 = require("axios");
const crypto = require("crypto");
class Okx {
    constructor(okxApiKey, okxApiSecret, okxPassphrase, okxBaseUrl) {
        this.apiKey = okxApiKey;
        this.apiSecret = okxApiSecret;
        this.passphrase = okxPassphrase;
        this.baseUrl = okxBaseUrl;
    }
    generateHeaders(method, endpoint, body = '') {
        const timestamp = new Date().toISOString();
        const message = `${timestamp}${method}${endpoint}${body}`;
        const sign = crypto
            .createHmac('sha256', this.apiSecret)
            .update(message)
            .digest('base64');
        return {
            'Content-Type': 'application/json',
            'OK-ACCESS-KEY': this.apiKey,
            'OK-ACCESS-SIGN': sign,
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': this.passphrase,
        };
    }
    async isOrderCanceled(response) {
        if (response && response.code === '0') {
            const dataArray = response.data || [];
            return dataArray.some((data) => data.sCode === '0');
        }
        return false;
    }
    async placeOrder(symbol, side, quantity, _PricePrecision, okxContractVal) {
        var _a, _b;
        const instId = symbol;
        const tdMode = 'cross';
        const orgside = side.toLowerCase();
        const contractValue = parseFloat(okxContractVal);
        const newSize = quantity / contractValue;
        const endpoint = '/api/v5/market/books';
        const url = `${this.baseUrl}${endpoint}`;
        const params = { instId };
        const headers = this.generateHeaders('GET', endpoint);
        try {
            const response = await axios_1.default.get(url, { headers, params });
            const orderBook = response.data;
            if (!((_a = orderBook === null || orderBook === void 0 ? void 0 : orderBook.data) === null || _a === void 0 ? void 0 : _a.length)) {
                console.error(`\nOrder book data unavailable for ${instId}`);
                return null;
            }
            const data = orderBook.data[0];
            const bestPrice = orgside === 'buy'
                ? parseFloat(data.bids[0][0])
                : parseFloat(data.asks[0][0]);
            console.log(`\nBest ${orgside === 'buy' ? 'Bid' : 'Ask'}: ${bestPrice}`);
            const orderResponse = await this.placeOrderokx(instId, orgside, 'post_only', newSize, tdMode, bestPrice.toString());
            return ((_b = orderResponse.data[0]) === null || _b === void 0 ? void 0 : _b.ordId) || null;
        }
        catch (error) {
            console.error(`\nError fetching BBO or placing order: ${error}`);
            return null;
        }
    }
    async placeOrderokx(instId, orgside, orderType, size, tdMode = 'cross', price) {
        const endpoint = '/api/v5/trade/order';
        const url = `${this.baseUrl}${endpoint}`;
        const order = {
            instId,
            tdMode,
            side: orgside,
            ordType: orderType,
            sz: size.toString(),
        };
        if (orderType === 'post_only' && price) {
            order.px = price;
        }
        const headers = this.generateHeaders('POST', endpoint, JSON.stringify(order));
        try {
            const response = await axios_1.default.post(url, order, { headers });
            console.log(JSON.stringify(order, null));
            console.log(`\nResponse: ${JSON.stringify(response.data, null)}\n`);
            return response.data;
        }
        catch (error) {
            console.error(`\nError placing order: ${error}`);
            return null;
        }
    }
    async getOrderStatus(ordId, symbol) {
        var _a;
        const endpoint = '/api/v5/trade/order';
        const params = { instId: symbol, ordId };
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.baseUrl}${endpoint}?${queryString}`;
        const headers = this.generateHeaders('GET', endpoint, `?${queryString}`);
        try {
            const response = await axios_1.default.get(url, { headers });
            if (response.status === 200) {
                const data = response.data;
                if (data.code === '0') {
                    const orderState = (_a = data.data[0]) === null || _a === void 0 ? void 0 : _a.state;
                    console.log(`\nOrder State on OKX: ${orderState}`);
                    return orderState || 'UNKNOWN';
                }
                else {
                    console.error(`\nError fetching order state: ${JSON.stringify(data)}`);
                    return null;
                }
            }
            else {
                console.error(`\nError fetching order state: ${response.status} ${response.statusText}`);
                console.error(`\nResponse: ${JSON.stringify(response.data)}`);
                return 'UNKNOWN';
            }
        }
        catch (error) {
            console.error(`\nError fetching order status: ${error.message}`);
            if (error.response) {
                console.error(`\nResponse Content: ${JSON.stringify(error.response.data, null)}`);
            }
            return 'UNKNOWN';
        }
    }
    async cancelOrder(ordId, symbol) {
        var _a;
        const endpoint = '/api/v5/trade/cancel-order';
        const url = `${this.baseUrl}${endpoint}`;
        const params = { instId: symbol, ordId };
        const headers = this.generateHeaders('POST', endpoint, JSON.stringify(params));
        try {
            const response = await axios_1.default.post(url, params, { headers });
            console.log('\nOrder cancelled on OKX:', JSON.stringify(response.data));
            return response.data;
        }
        catch (error) {
            console.error('\nError cancelling order on OKX:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            return null;
        }
    }
    async getTickSize(instId) {
        const endpoint = '/api/v5/public/instruments';
        const url = `${this.baseUrl}${endpoint}`;
        const params = { instType: 'SWAP' };
        try {
            console.log(`\nFetching tick size for instrument: ${instId}`);
            const response = await axios_1.default.get(url, { params });
            if (response.data.code === '0') {
                const instrument = response.data.data.find((item) => item.instId === instId);
                return instrument ? instrument.tickSz : null;
            }
            else {
                console.error('\nError fetching tick size:', response.data.msg);
                return null;
            }
        }
        catch (error) {
            console.error('\nError fetching tick size:', error.message);
            return null;
        }
    }
    async getContractInfo(instId) {
        var _a;
        const endpoint = `/api/v5/public/instruments?instType=SWAP&instId=${instId}`;
        const url = `${this.baseUrl}${endpoint}`;
        const headers = this.generateHeaders('GET', endpoint);
        try {
            const response = await axios_1.default.get(url, { headers });
            const data = response.data;
            if ((_a = data === null || data === void 0 ? void 0 : data.data) === null || _a === void 0 ? void 0 : _a.length) {
                return {
                    instrument_id: instId,
                    contract_multiplier: data.data[0].ctMult || 'N/A',
                    contract_value: data.data[0].ctVal || 'N/A',
                };
            }
            return {
                instrument_id: instId,
                contract_multiplier: 'N/A',
                contract_value: 'N/A',
            };
        }
        catch (error) {
            console.error(`\nError fetching contract info: ${error}`);
            return {
                instrument_id: instId,
                contract_multiplier: 'N/A',
                contract_value: 'N/A',
                error: error.message,
            };
        }
    }
}
exports.Okx = Okx;
//# sourceMappingURL=okx.js.map