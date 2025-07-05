"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderExecutor = void 0;
const common_1 = require("@nestjs/common");
const bybit_1 = require("../exchanges/bybit");
const okx_1 = require("../exchanges/okx");
const client_1 = require("@prisma/client");
const getRedisClient_1 = require("../utils/getRedisClient");
const constants_1 = require("../constants/constants");
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
        const config = this.getUserConfig();
        common_1.Logger.log(`${JSON.stringify(this.jobData)}`);
        const buyApi = this.longExchange;
        const sellApi = this.shortExchange;
        let buysymbol = config.symbols[config.buyExchange];
        let sellsymbol = config.symbols[config.sellExchange];
        let PricePrecision = null;
        if (buyApi instanceof bybit_1.Bybit || sellApi instanceof bybit_1.Bybit) {
            if (buyApi instanceof bybit_1.Bybit) {
                await buyApi.connectWebSocket(buysymbol);
            }
            if (sellApi instanceof bybit_1.Bybit) {
                await sellApi.connectWebSocket(sellsymbol);
            }
            while (PricePrecision === null) {
                try {
                    if (buyApi instanceof bybit_1.Bybit) {
                        PricePrecision = await buyApi.getPricePrecision(buysymbol);
                        if (PricePrecision) {
                            console.log(`\nPrice precision for Bybit (${buysymbol}): ${PricePrecision}`);
                        }
                        else {
                            throw new Error('\nUnable to fetch price precision for Bybit.');
                        }
                    }
                    if (sellApi instanceof bybit_1.Bybit) {
                        PricePrecision = await sellApi.getPricePrecision(sellsymbol);
                        if (PricePrecision) {
                            console.log(`\nPrice precision for Bybit (${sellsymbol}): ${PricePrecision}`);
                        }
                        else {
                            throw new Error('\nUnable to fetch price precision for Bybit.');
                        }
                    }
                }
                catch (error) {
                    console.error(`\nError fetching Bybit price precision: ${error}`);
                    console.log('\nRetrying to fetch Bybit price precision...');
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }
            }
        }
        let ContractVal = null;
        if (buyApi instanceof okx_1.Okx || sellApi instanceof okx_1.Okx) {
            while (ContractVal === null) {
                try {
                    if (buyApi instanceof okx_1.Okx) {
                        buysymbol = `${config.baseSymbol}-${config.assetForExchange2}-SWAP`;
                        const contractInfo = await buyApi.getContractInfo(buysymbol);
                        ContractVal = parseFloat(contractInfo.contract_value);
                        if (ContractVal) {
                            console.log(`\nokxContractVal: (${ContractVal})`);
                        }
                        else {
                            throw new Error('\nUnable to fetch okxContractVal.');
                        }
                    }
                    if (sellApi instanceof okx_1.Okx) {
                        sellsymbol = `${config.baseSymbol}-${config.assetForExchange1}-SWAP`;
                        const contractInfo = await sellApi.getContractInfo(sellsymbol);
                        ContractVal = parseFloat(contractInfo.contract_value);
                        if (ContractVal) {
                            console.log(`\nokxContractVal: (${ContractVal})`);
                        }
                        else {
                            throw new Error('\nUnable to fetch okxContractVal.');
                        }
                    }
                }
                catch (error) {
                    console.error(`\nUnable to fetch okxContractVal: ${error}`);
                    console.log('\nRetrying ...');
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }
            }
        }
        let count = 0;
        const totalIterations = config.totalQuantity / (config.minSlotQuantity * 2);
        common_1.Logger.debug(`\nTotal Iterations for job id ${this.jobId}: ${totalIterations}`);
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
            console.log('#'.repeat(40));
            console.log(`Iteration: ${count + 1} | Total Iterations: ${totalIterations}`);
            console.log('#'.repeat(40));
            const partiallyFilledCounter = { BUY: 0, SELL: 0 };
            const orderQuantity = config.minSlotQuantity;
            let buyOrderId = null;
            let buyretryCount = 0;
            const buymaxRetries = 10;
            while (!buyOrderId) {
                buyretryCount++;
                console.log(`\nAttempt ${buyretryCount} to place BUY order...`);
                try {
                    buyOrderId = await buyApi.placeOrder(buysymbol, 'BUY', orderQuantity, PricePrecision, ContractVal);
                }
                catch (error) {
                    console.error(`\nBUY order error: ${error}`);
                }
                if (buyOrderId) {
                    console.log(`\nBUY Order ID: ${buyOrderId}`);
                    orderTracker.buy.id = buyOrderId;
                    orderTracker.buy.status = 'UNKNOWN';
                }
                if (buyretryCount >= buymaxRetries && !buyOrderId) {
                    console.error('\nExceeded maximum retry attempts for BUY order. Terminating script.');
                    throw new Error('\nBUY order placement failed after maximum retries.');
                }
                if (!buyOrderId) {
                    console.log('\nRetrying BUY order...');
                    await new Promise((res) => setTimeout(res, 2000));
                }
            }
            let sellOrderId = null;
            let sellretryCount = 0;
            const sellmaxRetries = 10;
            while (!sellOrderId) {
                sellretryCount++;
                console.log(`\nAttempt ${sellretryCount} to place SELL order...`);
                try {
                    sellOrderId = await sellApi.placeOrder(sellsymbol, 'SELL', orderQuantity, PricePrecision, ContractVal);
                }
                catch (error) {
                    console.error(`\nSELL order error: ${error}`);
                }
                if (sellOrderId) {
                    console.log(`\nSELL Order ID: ${sellOrderId}`);
                    orderTracker.sell.id = sellOrderId;
                    orderTracker.sell.status = 'UNKNOWN';
                }
                if (sellretryCount >= sellmaxRetries && !sellOrderId) {
                    console.error('\nExceeded maximum retry attempts for sell order. Terminating script.');
                    throw new Error('\nSELL order placement failed after maximum retries.');
                }
                if (!sellOrderId) {
                    console.log('\nRetrying SELL order...');
                    await new Promise((res) => setTimeout(res, 2000));
                }
            }
            console.log('\nOrder Tracker:', orderTracker);
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
                let buyStatusResponse;
                try {
                    buyStatusResponse = await buyApi.getOrderStatus(buyOrderId, buysymbol);
                }
                catch (error) {
                    console.error(`\nError fetching BUY order status: ${error}`);
                }
                const buyStatus = (buyStatusResponse === null || buyStatusResponse === void 0 ? void 0 : buyStatusResponse.toUpperCase()) || 'UNKNOWN';
                orderTracker.buy.status = buyStatus;
                let sellStatusResponse;
                try {
                    sellStatusResponse = await sellApi.getOrderStatus(sellOrderId, sellsymbol);
                }
                catch (error) {
                    console.error(`\nError fetching SELL order status: ${error}`);
                }
                const sellStatus = (sellStatusResponse === null || sellStatusResponse === void 0 ? void 0 : sellStatusResponse.toUpperCase()) || 'UNKNOWN';
                orderTracker.sell.status = sellStatus;
                if (partially_filled_status.has(orderTracker.buy.status)) {
                    partiallyFilledCounter.BUY += 1;
                    console.log(`\nBUY order is PARTIALLY_FILLED. Counter: ${partiallyFilledCounter.BUY}`);
                }
                else {
                    partiallyFilledCounter.BUY = 0;
                }
                if (partially_filled_status.has(orderTracker.sell.status)) {
                    partiallyFilledCounter.SELL += 1;
                    console.log(`\nSELL order is PARTIALLY_FILLED. Counter: ${partiallyFilledCounter.SELL}`);
                }
                else {
                    partiallyFilledCounter.SELL = 0;
                }
                if (partiallyFilledCounter.BUY >= 2 ||
                    partiallyFilledCounter.SELL >= 2) {
                    console.log('\nOrder is PARTIALLY_FILLED for 2 consecutive iterations. Attempting to cancel both BUY and SELL orders...');
                    try {
                        await buyApi.cancelOrder(orderTracker.buy.id, buysymbol);
                    }
                    catch (error) {
                        console.error(`\nError canceling BUY order: ${error}`);
                    }
                    try {
                        await sellApi.cancelOrder(orderTracker.sell.id, sellsymbol);
                    }
                    catch (error) {
                        console.error(`\nError canceling SELL order: ${error}`);
                    }
                    console.log('\nSkipping to next iteration...');
                    count += 1;
                    break;
                }
                if (orderTracker.buy.status === filledStatus &&
                    orderTracker.sell.status === filledStatus) {
                    count = count + 1;
                    console.log('\nBoth BUY and SELL orders are FILLED. Exiting iteration.');
                    break;
                }
                else if (cancelStatuses.has(orderTracker.buy.status) &&
                    cancelStatuses.has(orderTracker.sell.status)) {
                    console.log('\nBoth the orders is canceled or expired. Exiting loop.');
                    break;
                }
                else if (activeStatuses.has(orderTracker.buy.status) &&
                    activeStatuses.has(orderTracker.sell.status)) {
                    console.log('\nBoth BUY and SELL orders are in NEW status after 2 seconds. Canceling both orders...');
                    try {
                        await buyApi.cancelOrder(buyOrderId, buysymbol);
                    }
                    catch (error) {
                        console.error(`\nError canceling BUY order: ${error}`);
                    }
                    try {
                        await sellApi.cancelOrder(sellOrderId, sellsymbol);
                    }
                    catch (error) {
                        console.error(`\nError canceling SELL order: ${error}`);
                    }
                }
                else if (activeStatuses.has(orderTracker.buy.status) &&
                    orderTracker.sell.status === filledStatus) {
                    console.log('\nBUY order is NEW while SELL order is FILLED. Canceling BUY order and placing a new one...');
                    let cancelSuccessful = false;
                    let cancelResponse = null;
                    try {
                        cancelResponse = await buyApi.cancelOrder(orderTracker.buy.id, buysymbol);
                    }
                    catch (error) {
                        console.error(`\nError canceling BUY order: ${error}`);
                    }
                    if (await buyApi.isOrderCanceled(cancelResponse)) {
                        console.log(`\nBUY order ${orderTracker.buy.id} successfully canceled on Binance.`);
                        cancelSuccessful = true;
                    }
                    if (cancelSuccessful) {
                        let newBuyOrderId = null;
                        try {
                            newBuyOrderId = await buyApi.placeOrder(buysymbol, 'BUY', config.minSlotQuantity, PricePrecision, ContractVal);
                        }
                        catch (e) {
                            console.error(`\nError placing new BUY order: ${e}`);
                        }
                        if (newBuyOrderId) {
                            console.log(`\nNew BUY order placed with ID: ${newBuyOrderId}`);
                            orderTracker.buy.id = newBuyOrderId;
                            orderTracker.buy.status = 'UNKNOWN';
                        }
                        console.log('\nOrder Tracker updated with new BUY order:', orderTracker);
                    }
                    else {
                        console.log('\nCancellation failed. Skipping new BUY order placement.');
                    }
                }
                else if (activeStatuses.has(orderTracker.sell.status) &&
                    orderTracker.buy.status === filledStatus) {
                    console.log('\nSELL order is ACTIVE while BUY order is FILLED. Canceling SELL order and placing a new one...');
                    let cancelSuccessful = false;
                    let cancelResponse = null;
                    try {
                        cancelResponse = await sellApi.cancelOrder(orderTracker.sell.id, sellsymbol);
                    }
                    catch (error) {
                        console.error(`\nError canceling SELL order: ${error}`);
                    }
                    if (await sellApi.isOrderCanceled(cancelResponse)) {
                        console.log(`\nSell order ${orderTracker.sell.id} successfully canceled on Binance.`);
                        cancelSuccessful = true;
                    }
                    if (cancelSuccessful) {
                        let newSellOrderId = null;
                        try {
                            newSellOrderId = await sellApi.placeOrder(sellsymbol, 'SELL', orderQuantity, PricePrecision, ContractVal);
                        }
                        catch (error) {
                            console.error(`\nError placing new SELL order: ${error}`);
                        }
                        if (newSellOrderId) {
                            orderTracker.sell.id = newSellOrderId;
                            orderTracker.sell.status = 'UNKNOWN';
                            console.log(`\nNew SELL order placed. Order ID: ${newSellOrderId}`);
                        }
                        else {
                            console.log('\nFailed to place new SELL order.');
                        }
                    }
                }
                else if (activeStatuses.has(orderTracker.buy.status) &&
                    cancelStatuses.has(orderTracker.sell.status)) {
                    console.log('\nBUY is ACTIVE and SELL is CANCELED. Canceling BUY order...');
                    try {
                        await buyApi.cancelOrder(orderTracker.buy.id, buysymbol);
                    }
                    catch (e) {
                        console.error(`\nError canceling BUY order: ${e}`);
                    }
                }
                else if (activeStatuses.has(orderTracker.sell.status) &&
                    cancelStatuses.has(orderTracker.buy.status)) {
                    console.log('\nSELL is ACTIVE and BUY is CANCELED. Canceling SELL order...');
                    try {
                        await sellApi.cancelOrder(orderTracker.sell.id, sellsymbol);
                    }
                    catch (e) {
                        console.error(`\nError canceling SELL order: ${e}`);
                    }
                    console.log('\nSELL order canceled as BUY was already canceled.');
                }
                if (cancelStatuses.has(orderTracker.buy.status) &&
                    orderTracker.sell.status === filledStatus) {
                    console.log('\nBUY is CANCELED and SELL is FILLED. Placing a new BUY order...');
                    let newBuyOrderId = null;
                    try {
                        newBuyOrderId = await buyApi.placeOrder(buysymbol, 'BUY', config.minSlotQuantity, PricePrecision, ContractVal);
                    }
                    catch (e) {
                        console.error(`\nError placing new BUY order: ${e}`);
                    }
                    if (newBuyOrderId) {
                        orderTracker.buy = { id: newBuyOrderId, status: 'UNKNOWN' };
                        console.log('\nNew BUY order placed and tracker updated:', orderTracker);
                    }
                    else {
                        console.log('\nFailed to place a new BUY order.');
                    }
                }
                if (cancelStatuses.has(orderTracker.sell.status) &&
                    orderTracker.buy.status === filledStatus) {
                    console.log('\nSELL is CANCELED and BUY is FILLED. Placing a new SELL order...');
                    let newSellOrderId = null;
                    try {
                        newSellOrderId = await sellApi.placeOrder(sellsymbol, 'SELL', orderQuantity, PricePrecision, ContractVal);
                    }
                    catch (e) {
                        console.error(`\nError placing new SELL order: ${e}`);
                    }
                    if (newSellOrderId) {
                        orderTracker.sell = { id: newSellOrderId, status: 'UNKNOWN' };
                        console.log('\nNew SELL order placed and tracker updated:', orderTracker);
                    }
                    else {
                        console.log('\nFailed to place a new SELL order.');
                    }
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
//# sourceMappingURL=TradingLogic.js.map