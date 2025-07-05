"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const binance_1 = require("../exchanges/binance");
const bybit_1 = require("../exchanges/bybit");
const okx_1 = require("../exchanges/okx");
dotenv.config({ path: '/Users/omji/Desktop/arbitrage/.env' });
const input = {
    basesymbol: 'BTC',
    exchange: 'BINANCE2',
    side: 'BUY',
    totalQty: 0.002,
    minQty: 0.002,
    asset: 'USDT',
};
function getExchangeCredentials(exchange) {
    switch (exchange) {
        case 'BINANCE1':
            return {
                API_KEY: process.env.BINANCE1_API_KEY,
                API_SECRET: process.env.BINANCE1_API_SECRET,
                BASE_URL: process.env.BINANCE1_BASE_URL,
            };
        case 'BINANCE2':
            return {
                API_KEY: process.env.BINANCE2_API_KEY,
                API_SECRET: process.env.BINANCE2_API_SECRET,
                BASE_URL: process.env.BINANCE2_BASE_URL,
            };
        case 'BYBIT':
            return {
                API_KEY: process.env.BYBIT_API_KEY,
                API_SECRET: process.env.BYBIT_API_SECRET,
                BASE_URL: process.env.BYBIT_BASE_URL,
            };
        case 'OKX':
            return {
                API_KEY: process.env.OKX_API_KEY,
                API_SECRET: process.env.OKX_API_SECRET,
                PASSPHRASE: process.env.OKX_PASSPHRASE,
                BASE_URL: process.env.OKX_BASE_URL,
            };
        default:
            throw new Error(`Unsupported exchange: ${exchange}`);
    }
}
async function positionMismatchHandling(input) {
    var _a, _b, _c, _d;
    const symbol = input.basesymbol + input.asset;
    console.log('Handling Position Mismatch...');
    console.log(`Symbol: ${symbol}`);
    console.log(`Exchange: ${input.exchange}`);
    console.log(`Side: ${input.side}`);
    console.log(`Total Quantity: ${input.totalQty}`);
    console.log(`Minimum Quantity: ${input.minQty}`);
    const credentials = getExchangeCredentials(input.exchange);
    const totalIterations = Math.floor(input.totalQty / input.minQty);
    console.log(`Total Count (TotalQty / MinQty): ${totalIterations}`);
    let count = 0;
    let apiClient;
    if (input.exchange.startsWith('BINANCE')) {
        apiClient = new binance_1.Binance(credentials.API_KEY, credentials.API_SECRET, credentials.BASE_URL);
    }
    else if (input.exchange === 'BYBIT') {
        apiClient = new bybit_1.Bybit(credentials.API_KEY, credentials.API_SECRET, credentials.BASE_URL);
    }
    else if (input.exchange === 'OKX') {
        apiClient = new okx_1.Okx(credentials.API_KEY, credentials.API_SECRET, credentials.PASSPHRASE, credentials.BASE_URL);
    }
    else {
        throw new Error(`Unsupported exchange: ${input.exchange}`);
    }
    const orderTracker = {
        id: null,
        status: 'UNKNOWN',
    };
    let bybitPricePrecision = null;
    if (input.exchange === 'BYBIT') {
        while (bybitPricePrecision === null) {
            try {
                if (apiClient instanceof bybit_1.Bybit) {
                    bybitPricePrecision = await apiClient.getPricePrecision(symbol);
                    if (bybitPricePrecision) {
                        console.log(`Price precision for Bybit (${symbol}): ${bybitPricePrecision}`);
                    }
                    else {
                        throw new Error('Unable to fetch price precision for Bybit.');
                    }
                }
            }
            catch (error) {
                console.error(`Error fetching Bybit price precision: ${error}`);
                console.log('Retrying to fetch Bybit price precision...');
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
    }
    let okxContractVal = null;
    if (input.exchange === 'OKX') {
        while (okxContractVal === null) {
            try {
                if (apiClient instanceof okx_1.Okx) {
                    const InstId = `${input.basesymbol}-${input.asset}-SWAP`;
                    const contractInfo = await apiClient.getContractInfo(InstId);
                    okxContractVal = parseFloat(contractInfo.contract_value);
                    if (okxContractVal) {
                        console.log(`okxContractVal: (${okxContractVal})`);
                    }
                    else {
                        throw new Error('Unable to fetch okxContractVal.');
                    }
                }
            }
            catch (error) {
                console.error(`Unable to fetch okxContractVal: ${error}`);
                console.log('Retrying ...');
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
    }
    while (count < totalIterations) {
        console.log(`Iteration ${count + 1} of ${totalIterations}`);
        const orderQuantity = input.minQty;
        let orderId = null;
        try {
            while (!orderId) {
                try {
                    let orderResponse;
                    if (apiClient instanceof binance_1.Binance) {
                        console.log('Placing order on Binance...');
                        orderResponse = await apiClient.placeOrderBinance(symbol, input.side, orderQuantity);
                        if (orderResponse && orderResponse.code === -2019) {
                            console.error('Error:', orderResponse.msg);
                            throw new Error('Order placement failed. Terminating script.');
                        }
                        orderId = (orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.clientOrderId) || null;
                    }
                    else if (apiClient instanceof bybit_1.Bybit) {
                        console.log('Placing order on Bybit...');
                        const bybitSide = input.side === 'BUY' ? 'Buy' : 'Sell';
                        orderResponse = await apiClient.placeLimitOrder(symbol, bybitSide, orderQuantity, bybitPricePrecision);
                        const errorCodesToHandle = [110044, 110004, 110012, 110045, 110052, 170033, 170131];
                        if (errorCodesToHandle.includes(orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.retCode)) {
                            console.error('Error:', orderResponse.retMsg);
                            throw new Error('BUY order placement failed. Terminating script.');
                        }
                        orderId = ((_a = orderResponse === null || orderResponse === void 0 ? void 0 : orderResponse.result) === null || _a === void 0 ? void 0 : _a.orderId) || null;
                    }
                    else if (apiClient instanceof okx_1.Okx) {
                        console.log('Placing order on OKX...');
                        const okxSide = input.side.toLowerCase();
                        const instId = `${input.basesymbol}-${input.asset}-SWAP`;
                        orderResponse = await apiClient.placeBboOrder(instId, okxSide, orderQuantity, okxContractVal);
                        orderId = ((_b = orderResponse.data[0]) === null || _b === void 0 ? void 0 : _b.ordId) || null;
                        const sMsg = ((_c = orderResponse.data[0]) === null || _c === void 0 ? void 0 : _c.sMsg) || null;
                        if (sMsg === 'Insufficient margin') {
                            throw new Error('Insufficient margin. Terminating script.');
                        }
                    }
                    if (!orderId || orderId === 'null') {
                        console.error('Failed to place order. Order ID is null.');
                    }
                    orderTracker.id = orderId;
                    orderTracker.status = 'UNKNOWN';
                    console.log(`Order placed successfully: Order ID = ${orderTracker.id} | Status = ${orderTracker.status}`);
                }
                catch (error) {
                    console.error(`Error placing order: ${error}`);
                    console.log('Retrying order placement...');
                    throw new Error('Process failed Terminating script.');
                }
            }
            const activeStatuses = new Set(['NEW', 'LIVE']);
            const cancelStatuses = new Set(['CANCELED', 'EXPIRED', 'CANCELLED']);
            const partially_filled_status = new Set([
                'PARTIALLY_FILLED',
                'PARTIALLYFILLED',
            ]);
            let partiallyFilledCounter = 0;
            while (true) {
                await new Promise((resolve) => setTimeout(resolve, 3000));
                try {
                    let statusResponse;
                    if (apiClient instanceof binance_1.Binance) {
                        statusResponse = await apiClient.fetchOrderStatusBinance(orderTracker.id, symbol);
                    }
                    else if (apiClient instanceof bybit_1.Bybit) {
                        statusResponse = await apiClient.fetchOrderStatus(orderTracker.id, symbol);
                    }
                    else if (apiClient instanceof okx_1.Okx) {
                        const instId = `${input.basesymbol}-${input.asset}-SWAP`;
                        statusResponse = await apiClient.getOrderStatus(orderTracker.id, instId);
                    }
                    orderTracker.status = (statusResponse === null || statusResponse === void 0 ? void 0 : statusResponse.toUpperCase()) || 'UNKNOWN';
                    console.log(`Order Status: ${orderTracker.status}`);
                    if (orderTracker.status === 'FILLED') {
                        console.log(`Order ${orderTracker.id} is filled.`);
                        count++;
                        break;
                    }
                    if (cancelStatuses.has(orderTracker.status)) {
                        console.log(`Order ${orderTracker.id} is Cancelled/expired.`);
                        break;
                    }
                    if (partially_filled_status.has(orderTracker.status)) {
                        partiallyFilledCounter++;
                        console.log(`Order ${orderTracker.id} is partially filled. Counter: ${partiallyFilledCounter}`);
                        if (partiallyFilledCounter >= 2) {
                            console.log(`Order ${orderTracker.id} is partially filled for 2 consecutive checks. Canceling...`);
                            try {
                                if (apiClient instanceof binance_1.Binance) {
                                    await apiClient.cancelOrderBinance(orderTracker.id, symbol);
                                }
                                else if (apiClient instanceof bybit_1.Bybit) {
                                    await apiClient.cancelOrder(orderTracker.id, symbol);
                                }
                                else if (apiClient instanceof okx_1.Okx) {
                                    const instId = `${input.basesymbol}-${input.asset}-SWAP`;
                                    await apiClient.cancelOrderById(orderTracker.id, instId);
                                }
                                console.log(`Order ${orderTracker.id} successfully canceled.`);
                            }
                            catch (cancelError) {
                                console.error(`Error canceling partially filled order ${orderTracker.id}:`, cancelError);
                            }
                            count = count + 1;
                            break;
                        }
                    }
                    else {
                        partiallyFilledCounter = 0;
                    }
                    if (activeStatuses.has(orderTracker.status)) {
                        console.log(`Order ${orderTracker.id} is active. Attempting to cancel...`);
                        try {
                            if (apiClient instanceof binance_1.Binance) {
                                console.log('Cancelling order on Binance...');
                                const cancelResponse = await apiClient.cancelOrderBinance(orderTracker.id, symbol);
                                if (cancelResponse && cancelResponse.code === 0) {
                                    console.log(`Order ${orderTracker.id} successfully canceled on Binance.`);
                                }
                            }
                            else if (apiClient instanceof bybit_1.Bybit) {
                                console.log('Cancelling order on Bybit...');
                                const cancelResponse = await apiClient.cancelOrder(orderTracker.id, symbol);
                                if (cancelResponse && cancelResponse.retCode === 0) {
                                    console.log(`Order ${orderTracker.id} successfully canceled on Bybit.`);
                                }
                            }
                            else if (apiClient instanceof okx_1.Okx) {
                                console.log('Cancelling order on OKX...');
                                const instId = `${input.basesymbol}-${input.asset}-SWAP`;
                                const cancelResponse = await apiClient.cancelOrderById(orderTracker.id, instId);
                                if (cancelResponse && ((_d = cancelResponse.data[0]) === null || _d === void 0 ? void 0 : _d.sCode) === '0') {
                                    console.log(`Order ${orderTracker.id} successfully canceled on OKX.`);
                                }
                            }
                        }
                        catch (cancelError) {
                            console.error(`Error canceling order ${orderTracker.id}:`, cancelError);
                        }
                    }
                    else {
                        console.log(`Order ${orderTracker.id} is not filled yet. Retrying...`);
                    }
                }
                catch (error) {
                    console.error(`Error checking order status: ${error}`);
                    console.log('Retrying status check...');
                }
            }
        }
        catch (error) {
            console.error(`Critical error during order placement or status monitoring: ${error}`);
        }
    }
    console.log('All orders processed successfully.');
}
positionMismatchHandling(input).catch((error) => {
    console.error('Error in position mismatch handling:', error);
});
//# sourceMappingURL=MismatchHandler.js.map