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
exports.JobDataDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class JobDataDto {
}
exports.JobDataDto = JobDataDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], JobDataDto.prototype, "symbol", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.CryptoExchangeType),
    __metadata("design:type", String)
], JobDataDto.prototype, "longExchange", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.CryptoExchangeType),
    __metadata("design:type", String)
], JobDataDto.prototype, "shortExchange", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], JobDataDto.prototype, "tickQuantity", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], JobDataDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], JobDataDto.prototype, "marketAssetLong", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], JobDataDto.prototype, "marketAssetShort", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], JobDataDto.prototype, "longSubAccount", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], JobDataDto.prototype, "shortSubAccount", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], JobDataDto.prototype, "longEntity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], JobDataDto.prototype, "shortEntity", void 0);
//# sourceMappingURL=jobData.dto.js.map