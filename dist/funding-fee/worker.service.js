"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FundingFeeWorkerService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const app_config_service_1 = require("../app-config/app-config.service");
const constants_1 = require("../constants/constants");
const database_service_1 = require("../database/database.service");
const getRedisClient_1 = require("../utils/getRedisClient");
const jobData_dto_1 = require("./dto/jobData.dto");
const validate_input_1 = require("../utils/validate-input");
const client_1 = require("@prisma/client");
const binance_1 = require("../exchanges/binance");
const bybit_1 = require("../exchanges/bybit");
const okx_1 = require("../exchanges/okx");
const TradingLogic_1 = require("./TradingLogic");
let FundingFeeWorkerService = class FundingFeeWorkerService {
    async onModuleInit() {
        new bullmq_1.Worker(constants_1.QueueNames.FUNDING_FEE_ARBITRAGE, async (job) => {
            const jobData = job.data;
            const jobId = job.id;
            return await this.processJob(jobId, jobData);
        }, {
            connection: this.redisServiceBmq,
            concurrency: this.appConfig.get('FUNDING_FEE_ARBITRAGE_PARALLEL_JOBS_COUNT'),
        });
        common_1.Logger.debug('Funding fee arbitrage worker initialized');
    }
    constructor(appConfig, db) {
        this.appConfig = appConfig;
        this.db = db;
        this.redisServiceBmq = (0, getRedisClient_1.getBullMqRedisClient)();
        this.exchangeCredentials = {
            OKX: {
                apiKey: this.appConfig.get('OKX_API_KEY'),
                apiSecret: this.appConfig.get('OKX_API_SECRET'),
                passphrase: this.appConfig.get('OKX_PASSPHRASE'),
                baseUrl: this.appConfig.get('OKX_BASE_URL'),
            },
            BYBIT: {
                apiKey: this.appConfig.get('BYBIT_API_KEY'),
                apiSecret: this.appConfig.get('BYBIT_API_SECRET'),
                baseUrl: this.appConfig.get('BYBIT_BASE_URL'),
                wsUrl: this.appConfig.get('BYBIT_WS_URL'),
            },
        };
    }
    async getBinanceCredentials(subAccount, entity) {
        try {
            const binanceCreds = await this.db.subAccountsDetails.findFirst({
                where: {
                    exchange: client_1.CryptoExchangeType.BINANCE,
                    subAccount: subAccount,
                    entity: entity || 'ZN',
                },
                select: {
                    apiKey: true,
                    apiSecret: true,
                },
            });
            if (!binanceCreds) {
                throw new Error(`No credentials found for Binance subAccount ${subAccount}`);
            }
            console.log(`Fetched Binance credentials for subAccount ${subAccount} and entity ${entity}`);
            return binanceCreds;
        }
        catch (error) {
            common_1.Logger.error(`Failed to fetch Binance credentials for subAccount ${subAccount} and entity ${entity}`, error);
            throw new Error('An error occurred while fetching Binance credentials');
        }
    }
    async getExchangeInstance(exchange, subAccount, entity) {
        let exchangeInstance = undefined;
        switch (exchange) {
            case client_1.CryptoExchangeType.BINANCE:
                const binanceCreds = await this.getBinanceCredentials(subAccount, entity);
                const binanceBaseUrl = this.appConfig.get('BINANCE_BASE_URL');
                exchangeInstance = new binance_1.Binance(binanceCreds.apiKey, binanceCreds.apiSecret, binanceBaseUrl);
                break;
            case client_1.CryptoExchangeType.BYBIT:
                const bybitCreds = this.exchangeCredentials.BYBIT;
                exchangeInstance = new bybit_1.Bybit(bybitCreds.apiKey, bybitCreds.apiSecret, bybitCreds.baseUrl, bybitCreds.wsUrl);
                break;
            case client_1.CryptoExchangeType.OKX:
                const okxCreds = this.exchangeCredentials.OKX;
                exchangeInstance = new okx_1.Okx(okxCreds.apiKey, okxCreds.apiSecret, okxCreds.passphrase || '', okxCreds.baseUrl);
                break;
            default:
                throw new Error('Unsupported exchange and subaccount combination');
        }
        return exchangeInstance;
    }
    async processJob(jobId, data) {
        let longExchangeInstance;
        let shortExchangeInstance;
        try {
            await (0, validate_input_1.validateInput)(jobData_dto_1.JobDataDto, data);
            longExchangeInstance = await this.getExchangeInstance(data.longExchange, data.longSubAccount, data.longEntity);
            shortExchangeInstance = await this.getExchangeInstance(data.shortExchange, data.shortSubAccount, data.shortEntity);
            const orderExecutor = new TradingLogic_1.OrderExecutor(data, longExchangeInstance, shortExchangeInstance, jobId);
            const response = await orderExecutor.execute();
            common_1.Logger.log(`Job with id ${jobId} completed`);
            await this.udpateJobInDb({
                jobId,
                jobStatus: response.jobStatus,
                processedQuantity: response.processedQuantity,
            });
            if (longExchangeInstance instanceof bybit_1.Bybit) {
                longExchangeInstance.closeWebSocket();
            }
            if (shortExchangeInstance instanceof bybit_1.Bybit) {
                shortExchangeInstance.closeWebSocket();
            }
        }
        catch (error) {
            common_1.Logger.error(`Error in processing job with id ${jobId}, data: ${JSON.stringify(data)}`, error);
            await this.udpateJobInDb({
                jobId,
                jobStatus: client_1.JobStatus.FAILED,
                processedQuantity: undefined,
            });
            if (longExchangeInstance instanceof bybit_1.Bybit) {
                longExchangeInstance.closeWebSocket();
            }
            if (shortExchangeInstance instanceof bybit_1.Bybit) {
                shortExchangeInstance.closeWebSocket();
            }
            throw error;
        }
    }
    async udpateJobInDb(data) {
        try {
            await this.db.fundingFeeArbitrageJobs.updateMany({
                where: {
                    jobId: data.jobId,
                },
                data: {
                    status: data.jobStatus,
                    processedQuantity: data.processedQuantity,
                },
            });
            common_1.Logger.debug(`Updated job in db ${JSON.stringify(data)}`);
        }
        catch (error) {
            common_1.Logger.error(`Failed to update job in database: ${JSON.stringify(data)}`, error);
        }
    }
};
exports.FundingFeeWorkerService = FundingFeeWorkerService;
exports.FundingFeeWorkerService = FundingFeeWorkerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_config_service_1.AppConfigService,
        database_service_1.DatabaseService])
], FundingFeeWorkerService);
//# sourceMappingURL=worker.service.js.map