export interface AppConfig {
    readonly POSTGRES_DB_URL: string;
    readonly PORT: number;
    readonly NODE_ENV: string;
    readonly SYSTEM_USER_ID: number;
    readonly BULLMQ_REDIS_HOST: string;
    readonly BULLMQ_REDIS_PORT: number;
    readonly QUEUE_NAME: string;
    readonly BINANCE_BASE_URL: string;
    readonly OKX_API_KEY: string;
    readonly OKX_API_SECRET: string;
    readonly OKX_PASSPHRASE: string;
    readonly OKX_BASE_URL: string;
    readonly BYBIT_API_KEY: string;
    readonly BYBIT_API_SECRET: string;
    readonly BYBIT_BASE_URL: string;
    readonly BYBIT_WS_URL: string;
    readonly FUNDING_FEE_ARBITRAGE_PARALLEL_JOBS_COUNT: number;
}
