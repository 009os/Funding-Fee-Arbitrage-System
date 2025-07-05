import { Exchange } from './exchange.interface';
interface ContractInfo {
    instrument_id: string;
    contract_multiplier: string | number;
    contract_value: string | number;
    error?: string;
}
export declare class Okx implements Exchange {
    private apiKey;
    private apiSecret;
    private passphrase;
    private baseUrl;
    constructor(okxApiKey: string, okxApiSecret: string, okxPassphrase: string, okxBaseUrl: string);
    private generateHeaders;
    isOrderCanceled(response: any): Promise<boolean>;
    placeOrder(symbol: string, side: string, quantity: number, _PricePrecision: number, okxContractVal: any): Promise<string | null>;
    placeOrderokx(instId: string, orgside: string, orderType: string, size: number, tdMode?: string, price?: string): Promise<any>;
    getOrderStatus(ordId: string, symbol: string): Promise<string | null>;
    cancelOrder(ordId: string, symbol: string): Promise<any>;
    getTickSize(instId: string): Promise<string | null>;
    getContractInfo(instId: string): Promise<ContractInfo>;
}
export {};
