"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FundingFeeModule = void 0;
const common_1 = require("@nestjs/common");
const worker_service_1 = require("./worker.service");
const app_config_module_1 = require("../app-config/app-config.module");
const database_module_1 = require("../database/database.module");
let FundingFeeModule = class FundingFeeModule {
};
exports.FundingFeeModule = FundingFeeModule;
exports.FundingFeeModule = FundingFeeModule = __decorate([
    (0, common_1.Module)({
        imports: [app_config_module_1.AppConfigModule, database_module_1.DatabaseModule],
        providers: [worker_service_1.FundingFeeWorkerService],
        exports: [],
    })
], FundingFeeModule);
//# sourceMappingURL=worker.module.js.map