import { Exchange } from './exchange.interface';
export declare class Bybit implements Exchange {
    private ws;
    private apiKey;
    private apiSecret;
    private baseUrl;
    private wsurl;
    private manualClose;
    private bestBid;
    private bestAsk;
    constructor(bybitApiKey: string, bybitApiSecret: string, bybitBaseUrl: string, bybitWsUrl: string);
    private createSignature;
    isOrderCanceled(response: any): Promise<boolean>;
    placeOrder(symbol: string, side: string, quantity: number, precision: number): Promise<string | null>;
    getOrderStatus(ordId: string, symbol: string): Promise<string | null>;
    cancelOrder(ordId: string, symbol: string): Promise<any>;
    getBestBidAndAsk(symbol: string): Promise<[number, number] | null>;
    connectWebSocket(symbol: string): Promise<void>;
    closeWebSocket(): void;
    getPricePrecision(symbol: string): Promise<number | null>;
}
