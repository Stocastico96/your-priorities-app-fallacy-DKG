"use strict";

const fs = require("fs/promises");
const path = require("path");
const { jsonrepair } = require("jsonrepair");
const OpenAI = require("openai");
const log = require("../../utils/logger.cjs");
const queue = require("../workers/queue.cjs");
const models = require("../../models/index.cjs");
const { v4: uuidv4 } = require("uuid");
const { PerspectiveAPIClient } = require("../engine/moderation/perspective_api_client.cjs");

const DELIB_STORAGE_DIR = path.resolve(
  process.env.DELIB_STORAGE_DIR || "storage/delib-annotations"
);

const openAiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE || undefined,
    })
  : null;

const perspectiveClient = process.env.GOOGLE_PERSPECTIVE_API_KEY
  ? new PerspectiveAPIClient({
      apiKey: process.env.GOOGLE_PERSPECTIVE_API_KEY,
    })
  : null;

const OPENAI_MODEL =
  process.env.OPENAI_STREAMING_MODEL_NAME || "deepseek/deepseek-chat-v3.1:free";

// Fallback models in order of preference
const FALLBACK_MODELS = [
  "deepseek/deepseek-chat-v3.1:free",
  "openrouter/polaris-alpha",
  "tngtech/deepseek-r1t2-chimera:free",
  "z-ai/glm-4.5-air:free",
  "tngtech/deepseek-r1t-chimera:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-r1-0528:free",
  "qwen/qwen3-235b-a22b:free",
  "google/gemini-2.0-flash-exp:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-r1:free",
];

const FALLACY_BLOCK_THRESHOLD = parseFloat(
  process.env.PERSPECTIVE_BLOCK_THRESHOLD || "0.85"
);
const FALLACY_SOFT_THRESHOLD = parseFloat(
  process.env.PERSPECTIVE_SOFT_THRESHOLD || "0.65"
);

const ensureStorageDir = async () => {
  try {
    await fs.mkdir(DELIB_STORAGE_DIR, { recursive: true });
  } catch (error) {
    log.error("Failed to ensure deliberation storage dir", { error });
  }
};

const perspectiveModerate = async (context) => {
  if (!perspectiveClient) return null;

  try {
    const response = await perspectiveClient.analyze(context.text, {
      attributes: [
        "TOXICITY",
        "SEVERE_TOXICITY",
        "INSULT",
        "PROFANITY",
        "THREAT",
        "IDENTITY_ATTACK",
        "SEXUALLY_EXPLICIT",
      ],
      doNotStore: true,
    });

    const scores = response.attributeScores || {};
    const toxicity = scores.TOXICITY?.summaryScore?.value || 0;

    let decision = "allow";
    if (toxicity >= FALLACY_BLOCK_THRESHOLD) {
      decision = "block";
    } else if (toxicity >= FALLACY_SOFT_THRESHOLD) {
      decision = "soft_warning";
    }

    return { decision, scores, raw: response };
  } catch (error) {
    log.error("Perspective moderation failed", { error });
    return null;
  }
};

const buildDelibPrompt = (context) => {
  return `Sei un esperto di logica argomentativa. Analizza il testo per identificare fallacie logiche.

IMPORTANTE: Sii SEVERO nell'identificare le fallacie. Anche lievi attacchi personali, generalizzazioni o linguaggio non costruttivo devono essere rilevati.

Rispondi SOLO con JSON valido (senza markdown, senza apici tripli, senza caratteri extra).

Formato:
{"fallacies":[{"label":"Nome","score":0.85,"rationale":"spiegazione"}],"advice":"","rewrite":"testo riformulato"}

Fallacie da cercare (sii SEVERO):
- Ad Hominem: qualsiasi attacco alla persona invece che all'argomento (es. "sei stupido", "non capisci niente", "idiota")
- Appeal to Emotion: linguaggio emotivo invece che razionale
- Hasty Generalization: generalizzazioni senza prove
- Straw Man: distorcere l'argomento altrui
- False Dilemma: presentare solo due opzioni

Se trovi anche UNA sola fallacia, DEVI segnalarla con score >= 0.7

Se il testo è perfettamente costruttivo e argomentato: {"fallacies":[],"advice":"","rewrite":""}

REWRITE: NON dare consigli o spiegazioni. Riscrivi DIRETTAMENTE il testo in prima persona, mantenendo il significato ma in forma costruttiva.

ESEMPI:
- Input: "Sei un idiota, non capisci niente"
  Rewrite: "Non sono d'accordo con questa posizione"

- Input: "I cani sono meglio delle persone"
  Rewrite: "Secondo me i cani hanno qualità straordinarie che a volte mancano in alcune persone"

- Input: "Questa proposta è stupida"
  Rewrite: "Questa proposta presenta alcuni problemi che andrebbero rivisti"

TESTO:
${context.text}

RISPONDI SOLO IL JSON:`;
};

const runDelibAi = async (context) => {
  if (!openAiClient) return null;

  const prompt = buildDelibPrompt(context);

  // Try primary model first
  const modelsToTry = [OPENAI_MODEL, ...FALLBACK_MODELS.filter(m => m !== OPENAI_MODEL)];

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      log.info(`DelibAI trying model ${i + 1}/${modelsToTry.length}`, { model });

      const response = await openAiClient.chat.completions.create({
        model: model,
        messages: [
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 512,
        temperature: 0.2,
      });

      const outputText = response?.choices?.[0]?.message?.content || "";

      if (!outputText) {
        log.warn("DelibAI model returned empty response", { model });
        continue;
      }

      const repaired = jsonrepair(outputText);
      const result = JSON.parse(repaired);

      log.info("DelibAI analysis successful", { model, hasFallacies: result.fallacies?.length > 0 });
      return result;
    } catch (error) {
      log.error(`DelibAI model ${model} failed`, {
        error: error.message,
        model,
        attempt: i + 1,
        remaining: modelsToTry.length - i - 1
      });

      // If this is the last model, return null
      if (i === modelsToTry.length - 1) {
        log.error("DelibAI all models failed");
        return null;
      }

      // Otherwise, continue to next model
      continue;
    }
  }

  return null;
};

const analyzeContent = async (context) => {
  const moderation = await perspectiveModerate(context);
  const delibResult = await runDelibAi(context);

  return { moderation, delibResult };
};

const shouldBlock = (moderation) => {
  if (!moderation) return false;
  return moderation.decision === "block";
};

const shouldWarn = (moderation) => {
  if (!moderation) return false;
  return moderation.decision === "soft_warning";
};

const persistPerspective = async (context, moderation) => {
  if (!moderation) return;
  const targetId =
    context.contentType === "comment"
      ? context.commentId
      : context.contentType === "point"
      ? context.pointId
      : context.ideaId;

  if (!targetId) return;

  await models.ModerationPerspective.create({
    content_type: context.contentType,
    content_id: targetId,
    toxicity: moderation.scores?.TOXICITY?.summaryScore?.value,
    severe_toxicity: moderation.scores?.SEVERE_TOXICITY?.summaryScore?.value,
    insult: moderation.scores?.INSULT?.summaryScore?.value,
    profanity: moderation.scores?.PROFANITY?.summaryScore?.value,
    threat: moderation.scores?.THREAT?.summaryScore?.value,
    identity_attack:
      moderation.scores?.IDENTITY_ATTACK?.summaryScore?.value,
    sexually_explicit:
      moderation.scores?.SEXUALLY_EXPLICIT?.summaryScore?.value,
    decision: moderation.decision,
    raw: moderation.raw,
  });
};

const persistDelibResult = async (context, analysis) => {
  if (!analysis || !analysis.delibResult) {
    log.info("Skipping persist - no analysis or delibResult", {
      hasAnalysis: !!analysis,
      hasDelibResult: !!analysis?.delibResult,
    });
    return;
  }

  const targetId =
    context.contentType === "comment"
      ? context.commentId
      : context.contentType === "point"
      ? context.pointId
      : context.ideaId;

  if (!targetId) {
    log.warn("Skipping persist - no targetId", { context });
    return;
  }

  const delibResult = analysis.delibResult;

  log.info("Persisting DelibAI result", {
    contentType: context.contentType,
    contentId: targetId,
    fallacyCount: delibResult.fallacies?.length || 0,
  });

  try {
    const created = await models.CommentFallacyLabels.create({
      content_type: context.contentType,
      content_id: targetId,
      labels: delibResult.fallacies || [],
      scores: (delibResult.fallacies || []).map((f) => ({
        label: f.label,
        score: f.score,
      })),
      advice: delibResult.advice,
      rewrite: delibResult.rewrite,
      model: OPENAI_MODEL,
      provider: "openrouter",
    });
    log.info("DelibAI result persisted successfully", {
      id: created.id,
      contentType: context.contentType,
      contentId: targetId,
    });
  } catch (error) {
    log.error("Failed to persist DelibAI result", {
      error: error.message,
      stack: error.stack,
      context,
    });
    throw error;
  }

  if (delibResult.ontologyHints && delibResult.ontologyHints.jsonld) {
    await ensureStorageDir();
    const filePath = path.join(
      DELIB_STORAGE_DIR,
      `${context.contentType}-${targetId}-${uuidv4()}.jsonld`
    );
    await fs.writeFile(
      filePath,
      JSON.stringify(delibResult.ontologyHints.jsonld, null, 2),
      "utf-8"
    );

    const savedAnnotation = await models.DeliberationAnnotations.create({
      content_type: context.contentType,
      content_id: targetId,
      jsonld: delibResult.ontologyHints.jsonld,
      model: OPENAI_MODEL,
      confidence: null,
    });

    // Enqueue for post-processing/logging in dedicated worker
    await queue.add(
      "delibai-analysis",
      {
        analysisId: savedAnnotation.id,
        jsonld: delibResult.ontologyHints.jsonld,
      },
      "low"
    );

    await queue.add(
      "delib-ai-ontology-index",
      {
        context,
        jsonld: delibResult.ontologyHints.jsonld,
        filePath,
      },
      "low"
    );
  }

  await queue.add(
    "delib-ai-fallacy-log",
    {
      context,
      delibResult,
    },
    "low"
  );
};

const persistAnalysis = async (context, analysis) => {
  await ensureStorageDir();
  await persistPerspective(context, analysis ? analysis.moderation : null);
  await persistDelibResult(context, analysis);
};

module.exports = {
  analyzeContent,
  persistAnalysis,
  shouldBlock,
  shouldWarn,
};
