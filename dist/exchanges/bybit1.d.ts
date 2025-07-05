export declare class Bybit {
    private manualClose;
    private apiKey;
    private apiSecret;
    private baseUrl;
    private wsurl;
    private ws;
    private bestBid;
    private bestAsk;
    constructor(bybitApiKey: string, bybitApiSecret: string, bybitBaseUrl: string, bybitWsUrl: string);
    private createSignature;
    connectWebSocket(symbol: string): Promise<void>;
    closeWebSocket(): void;
    getBestBidAndAsk(symbol: string): Promise<[number, number] | null>;
    placeLimitOrder(symbol: string, side: 'Buy' | 'Sell', qty: number, pricePrecision: number): Promise<any | null>;
    getPricePrecision(symbol: string): Promise<number | null>;
    fetchOrderStatus(orderId: string, symbol: string): Promise<any | null>;
    cancelOrder(orderId: string, symbol: string): Promise<any | null>;
    getOpenPositions(category?: string, symbol?: string): Promise<number | null>;
}
