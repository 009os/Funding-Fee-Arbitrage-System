import { Exchange } from './exchange.interface';
export declare class Binance implements Exchange {
    private readonly apiKey;
    private readonly apiSecret;
    private readonly baseUrl;
    constructor(apiKey: string, apiSecret: string, baseUrl: string);
    private createSignature;
    isOrderCanceled(response: any): Promise<boolean>;
    placeOrder(symbol: string, side: 'BUY' | 'SELL', quantity: number): Promise<string | null>;
    getOrderStatus(ordId: string, symbol: string): Promise<string | null>;
    cancelOrder(ordId: string, symbol: string): Promise<any>;
}
