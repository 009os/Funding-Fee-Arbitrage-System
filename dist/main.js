"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const app_config_service_1 = require("./app-config/app-config.service");
async function bootstrap() {
    BigInt.prototype['toJSON'] = function () {
        return Number(this);
    };
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const appConfig = app.get(app_config_service_1.AppConfigService);
    await app.listen(appConfig.get('PORT'));
}
bootstrap();
//# sourceMappingURL=main.js.map