"use strict";
const axios = require('axios');
class DelibAIService {
    constructor() {
        this.apiBase = process.env.OPENAI_API_BASE || 'https://openrouter.ai/api/v1';
        this.model = process.env.OPENAI_STREAMING_MODEL_NAME || 'google/gemini-2.0-flash-exp:free';
        this.apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
    }
    async analyzeFallacies(text) {
        const startTime = Date.now();
        const prompt = `Analyze the following comment for logical fallacies. Identify any fallacies present and provide:
1. A list of fallacy labels (e.g., "ad_hominem", "straw_man", "false_dichotomy")
2. Confidence scores for each fallacy (0-1)
3. Brief advice on how to improve the argument
4. A rewritten version without fallacies

Comment: "${text}"

Respond in JSON format:
{
  "labels": ["fallacy1", "fallacy2"],
  "scores": {"fallacy1": 0.85, "fallacy2": 0.65},
  "advice": "Your advice here",
  "rewrite": "Rewritten comment here"
}`;
        try {
            const response = await axios.post(`${this.apiBase}/chat/completions`, {
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert in logic and argumentation. Analyze text for logical fallacies.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' }
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://svagnoni.linkeddata.es',
                    'X-Title': 'Your Priorities DelibAI'
                }
            });
            const latency = Date.now() - startTime;
            const content = response.data.choices[0].message.content;
            const result = JSON.parse(content);
            return {
                labels: result.labels || [],
                scores: result.scores || {},
                advice: result.advice || null,
                rewrite: result.rewrite || null,
                model: this.model,
                provider: 'openrouter',
                latency_ms: latency
            };
        }
        catch (error) {
            console.error('DelibAI analysis error:', error.response?.data || error.message);
            throw new Error(`Fallacy analysis failed: ${error.message}`);
        }
    }
}
module.exports = new DelibAIService();
