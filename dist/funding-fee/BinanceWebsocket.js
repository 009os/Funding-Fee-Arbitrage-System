"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const axios_1 = require("axios");
const crypto_1 = require("crypto");
const API_KEY = 'your_api_key';
const API_SECRET = 'your_api_secret';
const FUTURES_WS_BASE = 'wss://fstream.binance.com/ws';
const FUTURES_API_BASE = 'https://fapi.binance.com/fapi/v1';
function generateSignature(secret, params) {
    const query = Object.entries(params)
        .map(([key, val]) => `${key}=${val}`)
        .join('&');
    return crypto_1.default.createHmac('sha256', secret).update(query).digest('hex');
}
async function getListenKey() {
    const response = await axios_1.default.post(`${FUTURES_API_BASE}/listenKey`, null, {
        headers: { 'X-MBX-APIKEY': API_KEY },
    });
    return response.data.listenKey;
}
async function keepAliveListenKey(listenKey) {
    try {
        await axios_1.default.put(`${FUTURES_API_BASE}/listenKey`, null, {
            headers: { 'X-MBX-APIKEY': API_KEY },
            params: { listenKey },
        });
        console.log('Listen key refreshed.');
    }
    catch (error) {
        console.error('Error refreshing listen key:', error);
    }
}
function createWebSocket(listenKey) {
    const wsUrl = `${FUTURES_WS_BASE}/${listenKey}`;
    const ws = new ws_1.default(wsUrl);
    ws.on('open', () => {
        console.log('WebSocket connection opened.');
    });
    ws.on('message', (data) => {
        console.log('Message received:', data.toString());
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
    ws.on('close', () => {
        console.log('WebSocket connection closed.');
    });
    return ws;
}
async function startAuthenticatedWebSocket() {
    try {
        const listenKey = await getListenKey();
        const ws = createWebSocket(listenKey);
        setInterval(() => keepAliveListenKey(listenKey), 30 * 60 * 1000);
        process.on('SIGINT', async () => {
            console.log('Terminating WebSocket and closing listen key...');
            await axios_1.default.delete(`${FUTURES_API_BASE}/listenKey`, {
                headers: { 'X-MBX-APIKEY': API_KEY },
                params: { listenKey },
            });
            ws.close();
            process.exit();
        });
    }
    catch (error) {
        console.error('Error starting WebSocket:', error);
    }
}
startAuthenticatedWebSocket();
//# sourceMappingURL=BinanceWebsocket.js.map