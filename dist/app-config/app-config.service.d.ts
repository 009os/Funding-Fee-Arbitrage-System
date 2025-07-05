import { AppConfig } from './types';
export declare class AppConfigService {
    private env;
    constructor();
    get<Property extends keyof AppConfig>(configProperty: Property): AppConfig[Property];
}
