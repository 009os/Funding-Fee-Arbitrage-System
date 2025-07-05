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
    async getTickSize(instId) {
        const endpoint = '/api/v5/public/instruments';
        const url = `${this.baseUrl}${endpoint}`;
        const params = { instType: 'SWAP' };
        try {
            console.log(`\nFetching tick size for instrument: ${instId}`);
            const response = await axios_1.default.get(url, { params });
            if (response.data.code === '0') {
                const instrument = response.data.data.find((item) => item.instId === instId);
                if (instrument) {
                    return instrument.tickSz;
                }
                else {
                    console.error(`\nInstrument ${instId} not found.`);
                    return null;
                }
            }
            else {
                console.error(`\nError fetching instruments: ${response.data.msg}`);
                return null;
            }
        }
        catch (error) {
            console.error(`\nError fetching tick size: ${error.message}`);
            return null;
        }
    }
    async placeBboOrder(instId, side, size, okxContractVal, tdMode = 'cross') {
        var _a;
        const contractValue = parseFloat(okxContractVal);
        size /= contractValue;
        const endpoint = '/api/v5/market/books';
        const url = `${this.baseUrl}${endpoint}`;
        const params = { instId };
        const headers = this.generateHeaders('GET', endpoint);
        try {
            const response = await axios_1.default.get(url, { headers, params });
            console.log(`\nFetching BBO for ${instId} to place a ${side.toUpperCase()} order...\n`);
            const orderBook = response.data;
            if (!((_a = orderBook === null || orderBook === void 0 ? void 0 : orderBook.data) === null || _a === void 0 ? void 0 : _a.length)) {
                console.error(`Order book data unavailable for ${instId}`);
                return null;
            }
            const data = orderBook.data[0];
            const bestPrice = side === 'buy'
                ? parseFloat(data.bids[0][0])
                : parseFloat(data.asks[0][0]);
            console.log(`Best ${side === 'buy' ? 'Bid' : 'Ask'}: ${bestPrice}`);
            const orderResponse = await this.placeOrder(instId, side, 'post_only', size, tdMode, bestPrice.toString());
            if (orderResponse && orderResponse.code === '0') {
                console.log(`Order placed successfully.`);
                return orderResponse;
            }
            else {
                console.error(`Error placing order: ${JSON.stringify(orderResponse, null, 4)}`);
                return orderResponse;
            }
        }
        catch (error) {
            console.error(`Error fetching BBO or placing order: ${error}`);
            return error.orderResponse;
        }
    }
    async placeOrder(instId, side, orderType, size, tdMode = 'cross', price) {
        const endpoint = '/api/v5/trade/order';
        const url = `${this.baseUrl}${endpoint}`;
        const order = {
            instId,
            tdMode,
            side,
            ordType: orderType,
            sz: size.toString(),
        };
        if (orderType === 'post_only' && price) {
            order.px = price;
        }
        const headers = this.generateHeaders('POST', endpoint, JSON.stringify(order));
        try {
            const response = await axios_1.default.post(url, order, { headers });
            console.log(`Placing ${orderType.toUpperCase()} order for ${instId}:`);
            console.log(JSON.stringify(order, null, 4));
            console.log(`Response: ${JSON.stringify(response.data, null, 4)}\n`);
            return response.data;
        }
        catch (error) {
            console.error(`Error placing order: ${error}`);
            return null;
        }
    }
    async getOrderStatus(ordId, instId) {
        var _a;
        const endpoint = '/api/v5/trade/order';
        const params = { instId, ordId };
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.baseUrl}${endpoint}?${queryString}`;
        const headers = this.generateHeaders('GET', endpoint, `?${queryString}`);
        try {
            console.log(`Fetching order status for Order ID: ${ordId}...\n`);
            const response = await axios_1.default.get(url, { headers });
            if (response.status === 200) {
                const data = response.data;
                if (data.code === '0') {
                    const orderState = (_a = data.data[0]) === null || _a === void 0 ? void 0 : _a.state;
                    console.log(`Order State: ${orderState}`);
                    return orderState || 'UNKNOWN';
                }
                else {
                    console.error(`Error fetching order state: ${JSON.stringify(data)}`);
                    return null;
                }
            }
            else {
                console.error(`Error fetching order state: ${response.status} ${response.statusText}`);
                console.error(`Response: ${response.data}`);
                return 'UNKNOWN';
            }
        }
        catch (error) {
            console.error(`Error fetching order status: ${error.message}`);
            if (error.response) {
                console.error(`Response Content: ${JSON.stringify(error.response.data, null, 4)}`);
            }
            return 'UNKNOWN';
        }
    }
    async cancelOrderById(ordId, instId) {
        const endpoint = '/api/v5/trade/cancel-order';
        const url = `${this.baseUrl}${endpoint}`;
        const body = { instId, ordId };
        const headers = this.generateHeaders('POST', endpoint, JSON.stringify(body));
        try {
            const response = await axios_1.default.post(url, body, { headers });
            console.log(`Cancelling Order ID: ${ordId} for ${instId}...\n`);
            console.log(`Response: ${JSON.stringify(response.data, null, 4)}\n`);
            return response.data;
        }
        catch (error) {
            console.error(`Error canceling order: ${error}`);
            return null;
        }
    }
    async printPositionsForSymbol(instId) {
        const endpoint = '/api/v5/account/positions';
        const url = `${this.baseUrl}${endpoint}`;
        const params = { instId };
        const headers = this.generateHeaders('GET', endpoint);
        try {
            const response = await axios_1.default.get(url, { headers, params });
            console.log(`Fetching open positions for symbol ${instId}...at OKX\n`);
            if (response.status === 200 && response.data.code === '0') {
                const positions = response.data.data;
                let crossPosition = null;
                for (const position of positions) {
                    if (position.mgnMode === 'cross') {
                        crossPosition = parseFloat(position.pos);
                        const contractInfo = await this.getContractInfo(instId);
                        if (contractInfo && contractInfo.contract_value !== 'N/A') {
                            const contractValue = parseFloat(contractInfo.contract_value);
                            const adjustedCrossPosition = crossPosition * contractValue;
                            console.log(`Adjusted Position: ${adjustedCrossPosition}`);
                            return Math.abs(adjustedCrossPosition);
                        }
                    }
                }
                return crossPosition !== null && crossPosition !== void 0 ? crossPosition : 0;
            }
            else {
                console.error(`Error fetching positions: ${response.data.msg}`);
                return null;
            }
        }
        catch (error) {
            console.error(`Error fetching positions: ${error}`);
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
            console.error(`Error fetching contract info: ${error}`);
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
//# sourceMappingURL=okx1.js.map