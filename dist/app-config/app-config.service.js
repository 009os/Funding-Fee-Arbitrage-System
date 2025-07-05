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
exports.AppConfigService = void 0;
const common_1 = require("@nestjs/common");
const dotenv = require("dotenv");
const envalid = require("envalid");
let AppConfigService = class AppConfigService {
    constructor() {
        dotenv.config();
        const env = envalid.cleanEnv(process.env, {
            POSTGRES_DB_URL: envalid.url(),
            PORT: envalid.num(),
            NODE_ENV: envalid.str(),
            SYSTEM_USER_ID: envalid.num(),
            BULLMQ_REDIS_HOST: envalid.str(),
            BULLMQ_REDIS_PORT: envalid.num(),
            QUEUE_NAME: envalid.str(),
            BINANCE_BASE_URL: envalid.str(),
            OKX_API_KEY: envalid.str(),
            OKX_API_SECRET: envalid.str(),
            OKX_PASSPHRASE: envalid.str(),
            OKX_BASE_URL: envalid.str(),
            BYBIT_API_KEY: envalid.str(),
            BYBIT_API_SECRET: envalid.str(),
            BYBIT_BASE_URL: envalid.str(),
            BYBIT_WS_URL: envalid.str(),
            FUNDING_FEE_ARBITRAGE_PARALLEL_JOBS_COUNT: envalid.num(),
        });
        this.env = env;
    }
    get(configProperty) {
        return this.env[configProperty];
    }
};
exports.AppConfigService = AppConfigService;
exports.AppConfigService = AppConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AppConfigService);
//# sourceMappingURL=app-config.service.js.map