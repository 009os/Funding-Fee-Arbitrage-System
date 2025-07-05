"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderExecutor = void 0;
const common_1 = require("@nestjs/common");
const binance1_1 = require("../exchanges/binance1");
const bybit1_1 = require("../exchanges/bybit1");
const okx1_1 = require("../exchanges/okx1");
const client_1 = require("@prisma/client");
const getRedisClient_1 = require("../utils/getRedisClient");
const constants_1 = require("../constants/constants");
function isOrderCanceledOkx(response) {
    if (response && response.code === '0') {
        const dataArray = response.data || [];
        return dataArray.some((data) => data.sCode === '0');
    }
    return false;
}
function isOrderCanceledBybit(response) {
    if (response && response.orderId) {
        console.log(`Order Canceled Successfully:`, response);
        return true;
    }
    return false;
}
function isOrderCanceledBinance(response) {
    if (response && response.status === 'CANCELED') {
        console.log(`Order Cancelled:`, response);
        return true;
    }
    return false;
}
class OrderExecutor {
    constructor(jobData, longExchange, shortExchange, jobId) {
        this.jobData = jobData;
        this.longExchange = longExchange;
        this.shortExchange = shortExchange;
        this.jobId = jobId;
        this.redisClient = (0, getRedisClient_1.getBullMqRedisClient)();
    }
    getUserConfig() {
        const { symbol: baseSymbol, longExchange, shortExchange, tickQuantity: minSlotQuantity, quantity: totalQuantity, marketAssetLong: assetForExchange1, marketAssetShort: assetForExchange2, } = this.jobData;
        const symbols = {
            [this.jobData.longExchange]: `${baseSymbol}${assetForExchange1}`,
            [this.jobData.shortExchange]: `${baseSymbol}${assetForExchange2}`,
        };
        return {
            symbols,
            buyExchange: longExchange,
            sellExchange: shortExchange,
            totalQuantity: totalQuantity,
            minSlotQuantity: minSlotQuantity,
            baseSymbol: baseSymbol,
            assetForExchange1: assetForExchange1,
            assetForExchange2: assetForExchange2,
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const config = this.getUserConfig();
        common_1.Logger.log(`${JSON.stringify(this.jobData)}`);
        const buyApi = this.longExchange;
        const sellApi = this.shortExchange;
        let bybitPricePrecision = null;
        if (buyApi instanceof bybit1_1.Bybit || sellApi instanceof bybit1_1.Bybit) {
            const symbolToMonitor = config.symbols[config.buyExchange] || config.symbols[config.sellExchange];
            if (buyApi instanceof bybit1_1.Bybit) {
                await buyApi.connectWebSocket(symbolToMonitor);
            }
            if (sellApi instanceof bybit1_1.Bybit) {
                await sellApi.connectWebSocket(symbolToMonitor);
            }
            while (bybitPricePrecision === null) {
                try {
                    if (buyApi instanceof bybit1_1.Bybit) {
                        bybitPricePrecision = await buyApi.getPricePrecision(config.symbols[config.buyExchange]);
                        if (bybitPricePrecision) {
                            console.log(`Price precision for Bybit (${config.symbols[config.buyExchange]}): ${bybitPricePrecision}`);
                        }
                        else {
                            throw new Error('Unable to fetch price precision for Bybit.');
                        }
                    }
                    if (sellApi instanceof bybit1_1.Bybit) {
                        bybitPricePrecision = await sellApi.getPricePrecision(config.symbols[config.sellExchange]);
                        if (bybitPricePrecision) {
                            console.log(`Price precision for Bybit (${config.symbols[config.sellExchange]}): ${bybitPricePrecision}`);
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
        if (buyApi instanceof okx1_1.Okx || sellApi instanceof okx1_1.Okx) {
            while (okxContractVal === null) {
                try {
                    if (buyApi instanceof okx1_1.Okx) {
                        const buyInstId = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                        const contractInfo = await buyApi.getContractInfo(buyInstId);
                        okxContractVal = parseFloat(contractInfo.contract_value);
                        if (okxContractVal) {
                            console.log(`okxContractVal: (${okxContractVal})`);
                        }
                        else {
                            throw new Error('Unable to fetch okxContractVal.');
                        }
                    }
                    if (sellApi instanceof okx1_1.Okx) {
                        const sellInstId = `${config.baseSymbol}-${config.assetForExchange1}-SWAP`;
                        const contractInfo = await sellApi.getContractInfo(sellInstId);
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
        let count = 0;
        const totalIterations = config.totalQuantity / (config.minSlotQuantity * 2);
        common_1.Logger.debug(`Total Iterations for job id ${this.jobId}: ${totalIterations}`);
        const orderTracker = {
            buy: {
                id: null,
                status: 'UNKNOWN',
            },
            sell: {
                id: null,
                status: 'UNKNOWN',
            },
        };
        while (count < totalIterations) {
            const isJobStopped = await this.redisClient.sismember(constants_1.REDIS_KEYS.FUNDING_FEE_ARBITRAGE_STOP, this.jobId);
            if (isJobStopped) {
                await this.redisClient.srem(constants_1.REDIS_KEYS.FUNDING_FEE_ARBITRAGE_STOP, this.jobId);
                return {
                    jobStatus: client_1.JobStatus.STOPPED,
                    processedQuantity: count * config.minSlotQuantity * 2,
                };
            }
            console.log('#'.repeat(20));
            console.log(`Iteration: ${count + 1} | Total Iterations: ${totalIterations}`);
            console.log('#'.repeat(20));
            const partiallyFilledCounter = { BUY: 0, SELL: 0 };
            const orderQuantity = config.minSlotQuantity;
            console.log(`Placing Order Quantity: ${orderQuantity}`);
            let buyOrderId = null;
            let buyretryCount = 0;
            const buymaxRetries = 10;
            while (!buyOrderId) {
                buyretryCount++;
                console.log(`Attempt ${buyretryCount} to place BUY order...`);
                if (buyApi instanceof binance1_1.Binance) {
                    try {
                        const buyResponse = await buyApi.placeOrderBinance(config.symbols[config.buyExchange], 'BUY', orderQuantity);
                        buyOrderId = (buyResponse === null || buyResponse === void 0 ? void 0 : buyResponse.clientOrderId) || null;
                    }
                    catch (error) {
                        console.error(`Binance BUY order error: ${error}`);
                    }
                }
                else if (buyApi instanceof bybit1_1.Bybit) {
                    try {
                        const buyResponse = await buyApi.placeLimitOrder(config.symbols[config.buyExchange], 'Buy', orderQuantity, bybitPricePrecision);
                        buyOrderId = ((_a = buyResponse === null || buyResponse === void 0 ? void 0 : buyResponse.result) === null || _a === void 0 ? void 0 : _a.orderId) || null;
                    }
                    catch (error) {
                        console.error(`Bybit BUY order error: ${error}`);
                    }
                }
                else if (buyApi instanceof okx1_1.Okx) {
                    try {
                        const buyInstId = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                        const buyResponse = await buyApi.placeBboOrder(buyInstId, 'buy', orderQuantity, okxContractVal);
                        buyOrderId = ((_b = buyResponse.data[0]) === null || _b === void 0 ? void 0 : _b.ordId) || null;
                    }
                    catch (error) {
                        console.error(`OKX BUY order error: ${error}`);
                    }
                }
                if (buyOrderId) {
                    console.log(`BUY Order ID: ${buyOrderId}`);
                    orderTracker.buy.id = buyOrderId;
                    orderTracker.buy.status = 'UNKNOWN';
                }
                if (buyretryCount >= buymaxRetries && !buyOrderId) {
                    console.error('Exceeded maximum retry attempts for BUY order. Terminating script.');
                    throw new Error('BUY order placement failed after maximum retries.');
                }
                if (!buyOrderId) {
                    console.log('Retrying BUY order...');
                    await new Promise(res => setTimeout(res, 2000));
                }
            }
            let sellOrderId = null;
            let sellretryCount = 0;
            const sellmaxRetries = 10;
            while (!sellOrderId) {
                sellretryCount++;
                console.log(`Attempt ${sellretryCount} to place SELL order...`);
                if (sellApi instanceof binance1_1.Binance) {
                    try {
                        const sellResponse = await sellApi.placeOrderBinance(config.symbols[config.sellExchange], 'SELL', orderQuantity);
                        sellOrderId = (sellResponse === null || sellResponse === void 0 ? void 0 : sellResponse.clientOrderId) || null;
                    }
                    catch (error) {
                        console.error(`Binance sell order error: ${error}`);
                    }
                }
                else if (sellApi instanceof bybit1_1.Bybit) {
                    try {
                        const sellResponse = await sellApi.placeLimitOrder(config.symbols[config.sellExchange], 'Sell', orderQuantity, bybitPricePrecision);
                        sellOrderId = ((_c = sellResponse === null || sellResponse === void 0 ? void 0 : sellResponse.result) === null || _c === void 0 ? void 0 : _c.orderId) || null;
                    }
                    catch (error) {
                        console.error(`Bybit SELL order error: ${error}`);
                    }
                }
                else if (sellApi instanceof okx1_1.Okx) {
                    try {
                        const sellInstId = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                        const sellResponse = await sellApi.placeBboOrder(sellInstId, 'sell', orderQuantity, okxContractVal);
                        sellOrderId = ((_d = sellResponse.data[0]) === null || _d === void 0 ? void 0 : _d.ordId) || null;
                    }
                    catch (error) {
                        console.error(`OKX SELL order error: ${error}`);
                    }
                }
                if (sellOrderId) {
                    console.log(`SELL Order ID: ${sellOrderId}`);
                    orderTracker.sell.id = sellOrderId;
                    orderTracker.sell.status = 'UNKNOWN';
                }
                if (sellretryCount >= sellmaxRetries && !sellOrderId) {
                    console.error('Exceeded maximum retry attempts for sell order. Terminating script.');
                    throw new Error('SELL order placement failed after maximum retries.');
                }
                if (!sellOrderId) {
                    console.log('Retrying SELL order...');
                    await new Promise(res => setTimeout(res, 2000));
                }
            }
            console.log('Order Tracker:', orderTracker);
            const activeStatuses = new Set(['NEW', 'LIVE']);
            const cancelStatuses = new Set(['CANCELED', 'EXPIRED', 'CANCELLED']);
            const filledStatus = 'FILLED';
            const partially_filled_status = new Set([
                'PARTIALLY_FILLED',
                'PARTIALLYFILLED',
            ]);
            while (true) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                const buyOrderId = orderTracker.buy.id;
                const sellOrderId = orderTracker.sell.id;
                try {
                    let buyStatusResponse;
                    if (buyApi instanceof binance1_1.Binance) {
                        try {
                            buyStatusResponse = await buyApi.fetchOrderStatusBinance(buyOrderId, config.symbols[config.buyExchange]);
                        }
                        catch (error) {
                            console.error(`Error fetching BUY order status: ${error}`);
                        }
                    }
                    else if (buyApi instanceof bybit1_1.Bybit) {
                        try {
                            buyStatusResponse = await buyApi.fetchOrderStatus(buyOrderId, config.symbols[config.buyExchange]);
                        }
                        catch (error) {
                            console.error(`Error fetching BUY order status: ${error}`);
                        }
                    }
                    else if (buyApi instanceof okx1_1.Okx) {
                        try {
                            buyStatusResponse = await buyApi.getOrderStatus(buyOrderId, `${config.baseSymbol}-${config.assetForExchange2}-SWAP`);
                        }
                        catch (error) {
                            console.error(`Error fetching BUY order status: ${error}`);
                        }
                    }
                    const buyStatus = (buyStatusResponse === null || buyStatusResponse === void 0 ? void 0 : buyStatusResponse.toUpperCase()) || 'UNKNOWN';
                    orderTracker.buy.status = buyStatus;
                    console.log(`Updated Buy Status: ${orderTracker.buy.status}`);
                    let sellStatusResponse;
                    if (sellApi instanceof binance1_1.Binance) {
                        try {
                            sellStatusResponse = await sellApi.fetchOrderStatusBinance(sellOrderId, config.symbols[config.sellExchange]);
                        }
                        catch (error) {
                            console.error(`Error fetching SELL order status: ${error}`);
                        }
                    }
                    else if (sellApi instanceof bybit1_1.Bybit) {
                        try {
                            sellStatusResponse = await sellApi.fetchOrderStatus(sellOrderId, config.symbols[config.sellExchange]);
                        }
                        catch (error) {
                            console.error(`Error fetching SELL order status: ${error}`);
                        }
                    }
                    else if (sellApi instanceof okx1_1.Okx) {
                        try {
                            sellStatusResponse = await sellApi.getOrderStatus(sellOrderId, `${config.baseSymbol}-${config.assetForExchange2}-SWAP`);
                        }
                        catch (error) {
                            console.error(`Error fetching SELL order status: ${error}`);
                        }
                    }
                    const sellStatus = (sellStatusResponse === null || sellStatusResponse === void 0 ? void 0 : sellStatusResponse.toUpperCase()) || 'UNKNOWN';
                    orderTracker.sell.status = sellStatus;
                    console.log(`Updated Sell Status: ${orderTracker.sell.status}`);
                    if (partially_filled_status.has(orderTracker.buy.status)) {
                        partiallyFilledCounter.BUY += 1;
                        console.log(`BUY order is PARTIALLY_FILLED. Counter: ${partiallyFilledCounter.BUY}`);
                    }
                    else {
                        partiallyFilledCounter.BUY = 0;
                    }
                    if (partially_filled_status.has(orderTracker.sell.status)) {
                        partiallyFilledCounter.SELL += 1;
                        console.log(`SELL order is PARTIALLY_FILLED. Counter: ${partiallyFilledCounter.SELL}`);
                    }
                    else {
                        partiallyFilledCounter.SELL = 0;
                    }
                    if (partiallyFilledCounter.BUY >= 2 ||
                        partiallyFilledCounter.SELL >= 2) {
                        console.log('Order is PARTIALLY_FILLED for 2 consecutive iterations. Attempting to cancel both BUY and SELL orders...');
                        try {
                            if (buyApi instanceof binance1_1.Binance) {
                                try {
                                    await buyApi.cancelOrderBinance(orderTracker.buy.id, config.symbols[config.buyExchange]);
                                }
                                catch (error) {
                                    console.error(`Error canceling BUY order: ${error}`);
                                }
                            }
                            else if (buyApi instanceof bybit1_1.Bybit) {
                                try {
                                    await buyApi.cancelOrder(orderTracker.buy.id, config.symbols[config.buyExchange]);
                                }
                                catch (error) {
                                    console.error(`Error canceling BUY order: ${error}`);
                                }
                            }
                            else if (buyApi instanceof okx1_1.Okx) {
                                try {
                                    const buyInstId = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                                    await buyApi.cancelOrderById(orderTracker.buy.id, buyInstId);
                                }
                                catch (error) {
                                    console.error(`Error canceling BUY order: ${error}`);
                                }
                            }
                        }
                        catch (error) {
                            console.error(`Error canceling BUY order: ${error}`);
                        }
                        try {
                            if (sellApi instanceof binance1_1.Binance) {
                                try {
                                    await sellApi.cancelOrderBinance(orderTracker.sell.id, config.symbols[config.sellExchange]);
                                }
                                catch (error) {
                                    console.error(`Error canceling SELL order: ${error}`);
                                }
                            }
                            else if (sellApi instanceof bybit1_1.Bybit) {
                                try {
                                    await sellApi.cancelOrder(orderTracker.sell.id, config.symbols[config.sellExchange]);
                                }
                                catch (error) {
                                    console.error(`Error canceling SELL order: ${error}`);
                                }
                            }
                            else if (sellApi instanceof okx1_1.Okx) {
                                try {
                                    const sellInstId = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                                    await sellApi.cancelOrderById(orderTracker.sell.id, sellInstId);
                                }
                                catch (error) {
                                    console.error(`Error canceling SELL order: ${error}`);
                                }
                                console.log('SELL order canceled successfully.');
                            }
                        }
                        catch (error) {
                            console.error(`Error canceling SELL order: ${error}`);
                        }
                        console.log('Skipping to next iteration...');
                        count += 1;
                        break;
                    }
                    if (orderTracker.buy.status === filledStatus &&
                        orderTracker.sell.status === filledStatus) {
                        count = count + 1;
                        console.log('Both BUY and SELL orders are FILLED.');
                        console.log('New BUY order placed and tracker updated:', orderTracker);
                        break;
                    }
                    else if (cancelStatuses.has(orderTracker.buy.status) &&
                        cancelStatuses.has(orderTracker.sell.status)) {
                        console.log('Both the orders is canceled or expired. Exiting loop.');
                        console.log('New BUY order placed and tracker updated:', orderTracker);
                        break;
                    }
                    else if (activeStatuses.has(orderTracker.buy.status) &&
                        activeStatuses.has(orderTracker.sell.status)) {
                        console.log('Both BUY and SELL orders are in NEW status after 3 seconds. Canceling both orders...');
                        try {
                            if (buyApi instanceof binance1_1.Binance) {
                                try {
                                    await buyApi.cancelOrderBinance(buyOrderId, config.symbols[config.buyExchange]);
                                }
                                catch (e) {
                                    console.error(`Error canceling BUY order: ${e}`);
                                }
                            }
                            else if (buyApi instanceof bybit1_1.Bybit) {
                                try {
                                    await buyApi.cancelOrder(buyOrderId, config.symbols[config.buyExchange]);
                                }
                                catch (e) {
                                    console.error(`Error canceling BUY order: ${e}`);
                                }
                            }
                            else if (buyApi instanceof okx1_1.Okx) {
                                try {
                                    const buyInstId = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                                    await buyApi.cancelOrderById(buyOrderId, buyInstId);
                                }
                                catch (e) {
                                    console.error(`Error canceling BUY order: ${e}`);
                                }
                            }
                            console.log('BUY order canceled successfully.');
                        }
                        catch (e) {
                            console.error(`Error canceling BUY order: ${e}`);
                        }
                        try {
                            if (sellApi instanceof binance1_1.Binance) {
                                try {
                                    await sellApi.cancelOrderBinance(sellOrderId, config.symbols[config.sellExchange]);
                                }
                                catch (e) {
                                    console.error(`Error canceling SELL order: ${e}`);
                                }
                            }
                            else if (sellApi instanceof bybit1_1.Bybit) {
                                try {
                                    await sellApi.cancelOrder(sellOrderId, config.symbols[config.sellExchange]);
                                }
                                catch (e) {
                                    console.error(`Error canceling SELL order: ${e}`);
                                }
                            }
                            else if (sellApi instanceof okx1_1.Okx) {
                                try {
                                    const sellInstId = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                                    await sellApi.cancelOrderById(sellOrderId, sellInstId);
                                }
                                catch (e) {
                                    console.error(`Error canceling SELL order: ${e}`);
                                }
                            }
                            console.log('SELL order canceled successfully.');
                        }
                        catch (e) {
                            console.error(`Error canceling SELL order: ${e}`);
                        }
                    }
                    else if (activeStatuses.has(orderTracker.buy.status) &&
                        orderTracker.sell.status === filledStatus) {
                        console.log('BUY order is NEW while SELL order is FILLED. Canceling BUY order and placing a new one...');
                        let cancelSuccessful = false;
                        try {
                            if (config.buyExchange === client_1.CryptoExchangeType.BINANCE &&
                                buyApi instanceof binance1_1.Binance) {
                                try {
                                    const cancelResponse = await buyApi.cancelOrderBinance(orderTracker.buy.id, config.symbols[config.buyExchange]);
                                    if (isOrderCanceledBinance(cancelResponse)) {
                                        console.log(`BUY order ${orderTracker.buy.id} successfully canceled on Binance.`);
                                        cancelSuccessful = true;
                                    }
                                }
                                catch (e) {
                                    console.error(`Error canceling BUY order: ${e}`);
                                }
                            }
                            else if (config.buyExchange === client_1.CryptoExchangeType.BYBIT &&
                                buyApi instanceof bybit1_1.Bybit) {
                                try {
                                    const cancelResponse = await buyApi.cancelOrder(orderTracker.buy.id, config.symbols[config.buyExchange]);
                                    if (isOrderCanceledBybit(cancelResponse)) {
                                        console.log(`BUY order ${orderTracker.buy.id} successfully canceled on Bybit.`);
                                        cancelSuccessful = true;
                                    }
                                }
                                catch (e) {
                                    console.error(`Error canceling BUY order: ${e}`);
                                }
                            }
                            else if (config.buyExchange === client_1.CryptoExchangeType.OKX &&
                                buyApi instanceof okx1_1.Okx) {
                                try {
                                    const buyInstId = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                                    const cancelResponse = await buyApi.cancelOrderById(orderTracker.buy.id, buyInstId);
                                    if (isOrderCanceledOkx(cancelResponse)) {
                                        console.log(`BUY order ${orderTracker.buy.id} successfully canceled on OKX.`);
                                        cancelSuccessful = true;
                                    }
                                }
                                catch (e) {
                                    console.error(`Error canceling BUY order: ${e}`);
                                }
                            }
                        }
                        catch (e) {
                            console.error(`Error canceling BUY order: ${e}`);
                        }
                        if (cancelSuccessful) {
                            let newBuyOrderId = null;
                            try {
                                if (config.buyExchange === client_1.CryptoExchangeType.BINANCE &&
                                    buyApi instanceof binance1_1.Binance) {
                                    try {
                                        const newBuyResponse = await buyApi.placeOrderBinance(config.symbols[config.buyExchange], 'BUY', config.minSlotQuantity);
                                        newBuyOrderId = (newBuyResponse === null || newBuyResponse === void 0 ? void 0 : newBuyResponse.clientOrderId) || null;
                                    }
                                    catch (e) {
                                        console.error(`Error placing new BUY order: ${e}`);
                                    }
                                }
                                else if (config.buyExchange === client_1.CryptoExchangeType.BYBIT &&
                                    buyApi instanceof bybit1_1.Bybit) {
                                    try {
                                        const newBuyResponse = await buyApi.placeLimitOrder(config.symbols[config.buyExchange], 'Buy', config.minSlotQuantity, bybitPricePrecision);
                                        newBuyOrderId = ((_e = newBuyResponse === null || newBuyResponse === void 0 ? void 0 : newBuyResponse.result) === null || _e === void 0 ? void 0 : _e.orderId) || null;
                                    }
                                    catch (e) {
                                        console.error(`Error placing new BUY order: ${e}`);
                                    }
                                }
                                else if (config.buyExchange === client_1.CryptoExchangeType.OKX &&
                                    buyApi instanceof okx1_1.Okx) {
                                    try {
                                        const buyInstId = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                                        const newBuyResponse = await buyApi.placeBboOrder(buyInstId, 'buy', config.minSlotQuantity, okxContractVal);
                                        newBuyOrderId = ((_f = newBuyResponse.data[0]) === null || _f === void 0 ? void 0 : _f.ordId) || null;
                                    }
                                    catch (e) {
                                        console.error(`Error placing new BUY order: ${e}`);
                                    }
                                }
                                if (newBuyOrderId) {
                                    console.log(`New BUY order placed with ID: ${newBuyOrderId}`);
                                    orderTracker.buy.id = newBuyOrderId;
                                    orderTracker.buy.status = 'UNKNOWN';
                                }
                            }
                            catch (e) {
                                console.error(`Error placing new BUY order: ${e}`);
                            }
                            console.log('Order Tracker updated with new BUY order:', orderTracker);
                        }
                        else {
                            console.log('Cancellation failed. Skipping new BUY order placement.');
                        }
                    }
                    else if (activeStatuses.has(orderTracker.sell.status) &&
                        orderTracker.buy.status === filledStatus) {
                        console.log('SELL order is ACTIVE while BUY order is FILLED. Canceling SELL order and placing a new one...');
                        let cancelSuccessful = false;
                        try {
                            if (config.sellExchange === client_1.CryptoExchangeType.BINANCE &&
                                sellApi instanceof binance1_1.Binance) {
                                try {
                                    const cancelResponse = await sellApi.cancelOrderBinance(orderTracker.sell.id, config.symbols[config.sellExchange]);
                                    if (isOrderCanceledBinance(cancelResponse)) {
                                        console.log(`Sell order ${orderTracker.sell.id} successfully canceled on Binance.`);
                                        cancelSuccessful = true;
                                    }
                                }
                                catch (e) {
                                    console.error(`Error canceling SELL order: ${e}`);
                                }
                            }
                            else if (config.sellExchange === client_1.CryptoExchangeType.BYBIT &&
                                sellApi instanceof bybit1_1.Bybit) {
                                try {
                                    const cancelResponse = await sellApi.cancelOrder(orderTracker.sell.id, config.symbols[config.sellExchange]);
                                    if (isOrderCanceledBybit(cancelResponse)) {
                                        console.log(`Sell order ${orderTracker.sell.id} successfully canceled on Bybit.`);
                                        cancelSuccessful = true;
                                    }
                                }
                                catch (e) {
                                    console.error(`Error canceling SELL order: ${e}`);
                                }
                            }
                            else if (config.sellExchange === client_1.CryptoExchangeType.OKX &&
                                sellApi instanceof okx1_1.Okx) {
                                try {
                                    const sellInstId = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                                    const cancelResponse = await sellApi.cancelOrderById(orderTracker.sell.id, sellInstId);
                                    if (isOrderCanceledOkx(cancelResponse)) {
                                        console.log(`Sell order ${orderTracker.sell.id} successfully canceled on OKX.`);
                                        cancelSuccessful = true;
                                    }
                                }
                                catch (e) {
                                    console.error(`Error canceling SELL order: ${e}`);
                                }
                            }
                            if (cancelSuccessful) {
                                try {
                                    let newSellOrderId = null;
                                    if (config.sellExchange === client_1.CryptoExchangeType.BINANCE &&
                                        sellApi instanceof binance1_1.Binance) {
                                        try {
                                            const newSellResponse = await sellApi.placeOrderBinance(config.symbols[config.sellExchange], 'SELL', orderQuantity);
                                            newSellOrderId = (newSellResponse === null || newSellResponse === void 0 ? void 0 : newSellResponse.clientOrderId) || null;
                                        }
                                        catch (e) {
                                            console.error(`Error placing new SELL order: ${e}`);
                                        }
                                    }
                                    else if (config.sellExchange === client_1.CryptoExchangeType.BYBIT &&
                                        sellApi instanceof bybit1_1.Bybit) {
                                        try {
                                            const newSellResponse = await sellApi.placeLimitOrder(config.symbols[config.sellExchange], 'Sell', orderQuantity, bybitPricePrecision);
                                            newSellOrderId = ((_g = newSellResponse === null || newSellResponse === void 0 ? void 0 : newSellResponse.result) === null || _g === void 0 ? void 0 : _g.orderId) || null;
                                        }
                                        catch (e) {
                                            console.error(`Error placing new SELL order: ${e}`);
                                        }
                                    }
                                    else if (config.sellExchange === client_1.CryptoExchangeType.OKX &&
                                        sellApi instanceof okx1_1.Okx) {
                                        try {
                                            const sellInstId = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                                            const newSellResponse = await sellApi.placeBboOrder(sellInstId, 'sell', orderQuantity, okxContractVal);
                                            newSellOrderId = ((_h = newSellResponse.data[0]) === null || _h === void 0 ? void 0 : _h.ordId) || null;
                                        }
                                        catch (e) {
                                            console.error(`Error placing new SELL order: ${e}`);
                                        }
                                    }
                                    if (newSellOrderId) {
                                        orderTracker.sell.id = newSellOrderId;
                                        orderTracker.sell.status = 'UNKNOWN';
                                        console.log(`New SELL order placed. Order ID: ${newSellOrderId}`);
                                    }
                                    else {
                                        console.log('Failed to place new SELL order.');
                                    }
                                }
                                catch (e) {
                                    console.error(`Error placing new SELL order: ${e}`);
                                }
                            }
                        }
                        catch (e) {
                            console.error(`Error: ${e}`);
                        }
                    }
                    if (activeStatuses.has(orderTracker.buy.status) &&
                        cancelStatuses.has(orderTracker.sell.status)) {
                        console.log('BUY is ACTIVE and SELL is CANCELED. Canceling BUY order...');
                        try {
                            if (config.buyExchange === client_1.CryptoExchangeType.BINANCE &&
                                buyApi instanceof binance1_1.Binance) {
                                try {
                                    await buyApi.cancelOrderBinance(orderTracker.buy.id, config.symbols[config.buyExchange]);
                                    console.log('BUY order successfully canceled on Binance.');
                                }
                                catch (error) {
                                    console.error(`Error canceling BUY order: ${error}`);
                                }
                            }
                            else if (config.buyExchange === client_1.CryptoExchangeType.BYBIT &&
                                buyApi instanceof bybit1_1.Bybit) {
                                try {
                                    await buyApi.cancelOrder(orderTracker.buy.id, config.symbols[config.buyExchange]);
                                    console.log('BUY order successfully canceled on Bybit.');
                                }
                                catch (error) {
                                    console.error(`Error canceling BUY order: ${error}`);
                                }
                            }
                            else if (config.buyExchange === client_1.CryptoExchangeType.OKX &&
                                buyApi instanceof okx1_1.Okx) {
                                try {
                                    const buyInstId = `${config.baseSymbol}-${config.assetForExchange1}-SWAP`;
                                    await buyApi.cancelOrderById(orderTracker.buy.id, buyInstId);
                                    console.log('BUY order successfully canceled on OKX.');
                                }
                                catch (error) {
                                    console.error(`Error canceling BUY order: ${error}`);
                                }
                            }
                        }
                        catch (error) {
                            console.error(`Error canceling BUY order: ${error}`);
                        }
                        console.log('BUY order canceled as SELL was already canceled.');
                    }
                    if (activeStatuses.has(orderTracker.sell.status) &&
                        cancelStatuses.has(orderTracker.buy.status)) {
                        console.log('SELL is ACTIVE and BUY is CANCELED. Canceling SELL order...');
                        try {
                            if (config.sellExchange === client_1.CryptoExchangeType.BINANCE &&
                                sellApi instanceof binance1_1.Binance) {
                                try {
                                    await sellApi.cancelOrderBinance(orderTracker.sell.id, config.symbols[config.sellExchange]);
                                    console.log('SELL order successfully canceled on Binance.');
                                }
                                catch (error) { }
                            }
                            else if (config.sellExchange === client_1.CryptoExchangeType.BYBIT &&
                                sellApi instanceof bybit1_1.Bybit) {
                                try {
                                    await sellApi.cancelOrder(orderTracker.sell.id, config.symbols[config.sellExchange]);
                                    console.log('SELL order successfully canceled on Bybit.');
                                }
                                catch (error) {
                                    console.error(`Error canceling SELL order: ${error}`);
                                }
                            }
                            else if (config.sellExchange === client_1.CryptoExchangeType.OKX &&
                                sellApi instanceof okx1_1.Okx) {
                                try {
                                    const sellInstId = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                                    await sellApi.cancelOrderById(orderTracker.sell.id, sellInstId);
                                    console.log('SELL order successfully canceled on OKX.');
                                }
                                catch (error) {
                                    console.error(`Error canceling SELL order: ${error}`);
                                }
                            }
                        }
                        catch (error) {
                            console.error(`Error canceling SELL order: ${error}`);
                        }
                        console.log('SELL order canceled as BUY was already canceled.');
                    }
                    if (cancelStatuses.has(orderTracker.buy.status) &&
                        orderTracker.sell.status === filledStatus) {
                        console.log('BUY is CANCELED and SELL is FILLED. Placing a new BUY order...');
                        let newBuyOrderId = null;
                        try {
                            if (config.buyExchange === client_1.CryptoExchangeType.BINANCE &&
                                buyApi instanceof binance1_1.Binance) {
                                try {
                                    const buyResponse = await buyApi.placeOrderBinance(config.symbols[config.buyExchange], 'BUY', config.minSlotQuantity);
                                    newBuyOrderId = (buyResponse === null || buyResponse === void 0 ? void 0 : buyResponse.clientOrderId) || null;
                                    console.log(`New BUY order placed on Binance. Order ID: ${newBuyOrderId}`);
                                }
                                catch (error) {
                                    console.error(`Error placing BUY order: ${error}`);
                                }
                            }
                            else if (config.buyExchange === client_1.CryptoExchangeType.BYBIT &&
                                buyApi instanceof bybit1_1.Bybit) {
                                try {
                                    const buyResponse = await buyApi.placeLimitOrder(config.symbols[config.buyExchange], 'Buy', config.minSlotQuantity, bybitPricePrecision);
                                    newBuyOrderId = ((_j = buyResponse === null || buyResponse === void 0 ? void 0 : buyResponse.result) === null || _j === void 0 ? void 0 : _j.orderId) || null;
                                    console.log(`New BUY order placed on Bybit. Order ID: ${newBuyOrderId}`);
                                }
                                catch (error) {
                                    console.error(`Error placing BUY order: ${error}`);
                                }
                            }
                            else if (config.buyExchange === client_1.CryptoExchangeType.OKX &&
                                buyApi instanceof okx1_1.Okx) {
                                try {
                                    const buyInstId = `${config.baseSymbol}-${config.assetForExchange1}-SWAP`;
                                    const buyResponse = await buyApi.placeBboOrder(buyInstId, 'buy', config.minSlotQuantity, okxContractVal);
                                    newBuyOrderId = ((_k = buyResponse.data[0]) === null || _k === void 0 ? void 0 : _k.ordId) || null;
                                    console.log(`New BUY order placed on OKX. Order ID: ${newBuyOrderId}`);
                                }
                                catch (error) {
                                    console.error(`Error placing new BUY order: ${error}`);
                                }
                            }
                        }
                        catch (error) {
                            console.error(`Error placing new BUY order: ${error}`);
                        }
                        if (newBuyOrderId) {
                            orderTracker.buy = { id: newBuyOrderId, status: 'UNKNOWN' };
                            console.log('New BUY order placed and tracker updated:', orderTracker);
                        }
                        else {
                            console.log('Failed to place a new BUY order.');
                        }
                    }
                    if (cancelStatuses.has(orderTracker.sell.status) &&
                        orderTracker.buy.status === filledStatus) {
                        console.log('SELL is CANCELED and BUY is FILLED. Placing a new SELL order...');
                        let newSellOrderId = null;
                        try {
                            if (config.sellExchange === client_1.CryptoExchangeType.BINANCE &&
                                sellApi instanceof binance1_1.Binance) {
                                try {
                                    const sellResponse = await sellApi.placeOrderBinance(config.symbols[config.sellExchange], 'SELL', config.minSlotQuantity);
                                    newSellOrderId = (sellResponse === null || sellResponse === void 0 ? void 0 : sellResponse.clientOrderId) || null;
                                    console.log(`New SELL order placed on Binance. Order ID: ${newSellOrderId}`);
                                }
                                catch (error) {
                                    console.error(`Error placing SELL order: ${error}`);
                                }
                            }
                            else if (config.sellExchange === client_1.CryptoExchangeType.BYBIT &&
                                sellApi instanceof bybit1_1.Bybit) {
                                try {
                                    const sellResponse = await sellApi.placeLimitOrder(config.symbols[config.sellExchange], 'Sell', config.minSlotQuantity, bybitPricePrecision);
                                    newSellOrderId = ((_l = sellResponse === null || sellResponse === void 0 ? void 0 : sellResponse.result) === null || _l === void 0 ? void 0 : _l.orderId) || null;
                                    console.log(`New SELL order placed on Bybit. Order ID: ${newSellOrderId}`);
                                }
                                catch (error) {
                                    console.error(`Error placing SELL order: ${error}`);
                                }
                            }
                            else if (config.sellExchange === client_1.CryptoExchangeType.OKX &&
                                sellApi instanceof okx1_1.Okx) {
                                try {
                                    const sellInstId = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                                    const sellResponse = await sellApi.placeBboOrder(sellInstId, 'sell', config.minSlotQuantity, okxContractVal);
                                    newSellOrderId = ((_m = sellResponse.data[0]) === null || _m === void 0 ? void 0 : _m.ordId) || null;
                                    console.log(`New SELL order placed on OKX. Order ID: ${newSellOrderId}`);
                                }
                                catch (error) {
                                    console.error(`Error placing new SELL order: ${error}`);
                                }
                            }
                        }
                        catch (error) {
                            console.error(`Error placing new SELL order: ${error}`);
                        }
                        if (newSellOrderId) {
                            orderTracker.sell = { id: newSellOrderId, status: 'UNKNOWN' };
                            console.log('New SELL order placed and tracker updated:', orderTracker);
                        }
                        else {
                            console.log('Failed to place a new SELL order.');
                        }
                    }
                    console.log('New BUY order placed and tracker updated:', orderTracker);
                }
                catch (e) {
                    console.error(`Error fetching order status: ${e}`);
                }
            }
        }
        return {
            jobStatus: client_1.JobStatus.COMPLETED,
            processedQuantity: count * config.minSlotQuantity * 2,
        };
    }
}
exports.OrderExecutor = OrderExecutor;
//# sourceMappingURL=TradingLogic1.js.map