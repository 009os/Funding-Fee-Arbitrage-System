import { JobDataDto } from './dto/jobData.dto';
import { JobStatus } from '@prisma/client';
export declare class OrderExecutor {
    private readonly jobData;
    private readonly longExchange;
    private readonly shortExchange;
    private readonly jobId;
    private readonly redisClient;
    constructor(jobData: JobDataDto, longExchange: any, shortExchange: any, jobId: string);
    private getUserConfig;
    execute(): Promise<{
        processedQuantity: number;
        jobStatus: JobStatus;
    }>;
}
