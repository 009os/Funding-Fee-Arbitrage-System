"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_config_module_1 = require("./app-config/app-config.module");
const database_module_1 = require("./database/database.module");
const worker_module_1 = require("./funding-fee/worker.module");
const app_config_service_1 = require("./app-config/app-config.service");
const constants_1 = require("./constants/constants");
const appConfig = new app_config_service_1.AppConfigService();
let modulesToInitialize;
const queue = appConfig.get('QUEUE_NAME');
switch (queue) {
    case constants_1.QueueNames.FUNDING_FEE_ARBITRAGE:
        modulesToInitialize = [worker_module_1.FundingFeeModule];
        break;
    default:
        modulesToInitialize = [];
}
if (modulesToInitialize.length === 0) {
    throw new Error('Unsupported queue name');
}
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [app_config_module_1.AppConfigModule, database_module_1.DatabaseModule, ...modulesToInitialize],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map