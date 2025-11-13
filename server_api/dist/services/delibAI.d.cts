declare const _exports: DelibAIService;
export = _exports;
declare class DelibAIService {
    apiBase: string;
    model: string;
    apiKey: string | undefined;
    analyzeFallacies(text: any): Promise<{
        labels: any;
        scores: any;
        advice: any;
        rewrite: any;
        model: string;
        provider: string;
        latency_ms: number;
    }>;
}
