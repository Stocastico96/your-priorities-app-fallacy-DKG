export function analyzeContent(context: any): Promise<{
    moderation: {
        decision: string;
        scores: any;
        raw: any;
    } | null;
    delibResult: any;
}>;
export function persistAnalysis(context: any, analysis: any): Promise<void>;
export function shouldBlock(moderation: any): boolean;
export function shouldWarn(moderation: any): boolean;
