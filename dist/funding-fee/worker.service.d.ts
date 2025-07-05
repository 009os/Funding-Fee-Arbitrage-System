import { AppConfigService } from 'src/app-config/app-config.service';
import { DatabaseService } from 'src/database/database.service';
export declare class FundingFeeWorkerService {
    private readonly appConfig;
    private readonly db;
    private readonly redisServiceBmq;
    private readonly exchangeCredentials;
    onModuleInit(): Promise<void>;
    constructor(appConfig: AppConfigService, db: DatabaseService);
    private getBinanceCredentials;
    private getExchangeInstance;
    private processJob;
    private udpateJobInDb;
}
