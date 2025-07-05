interface ContractInfo {
    instrument_id: string;
    contract_multiplier: string | number;
    contract_value: string | number;
    error?: string;
}
export declare class Okx {
    private apiKey;
    private apiSecret;
    private passphrase;
    private baseUrl;
    constructor(okxApiKey: string, okxApiSecret: string, okxPassphrase: string, okxBaseUrl: string);
    private generateHeaders;
    getTickSize(instId: string): Promise<string | null>;
    placeBboOrder(instId: string, side: 'buy' | 'sell', size: number, okxContractVal: any, tdMode?: string): Promise<any | null>;
    placeOrder(instId: string, side: string, orderType: string, size: number, tdMode?: string, price?: string): Promise<any>;
    getOrderStatus(ordId: string, instId: string): Promise<string | null>;
    cancelOrderById(ordId: string, instId: string): Promise<any>;
    printPositionsForSymbol(instId: string): Promise<number | null>;
    getContractInfo(instId: string): Promise<ContractInfo>;
}
export {};
