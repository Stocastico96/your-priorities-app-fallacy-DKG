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
  process.env.OPENAI_STREAMING_MODEL_NAME || "google/gemini-2.0-flash-exp:free";

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
  return `Analizza questo commento deliberativo e rispondi SOLO con JSON: {"fallacies":[{"label":"","score":0.0,"rationale":""}],"advice":"","rewrite":"","ontologyHints":{"explanations":[]}}.

Identifica fallacie logiche, proponi riformulazione costruttiva, classifica come Issue/Claim/Evidence/CounterArgument.

TESTO: ${context.text}`;
};

const runDelibAi = async (context) => {
  if (!openAiClient) return null;

  const prompt = buildDelibPrompt(context);

  try {
    const response = await openAiClient.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 512,
      temperature: 0.2,
    });

    const outputText = response?.choices?.[0]?.message?.content || "";

    if (!outputText) return null;

    const repaired = jsonrepair(outputText);
    return JSON.parse(repaired);
  } catch (error) {
    log.error("DelibAI OpenRouter call failed", { error });
    return null;
  }
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
  if (!analysis || !analysis.delibResult) return;

  const targetId =
    context.contentType === "comment"
      ? context.commentId
      : context.contentType === "point"
      ? context.pointId
      : context.ideaId;

  if (!targetId) return;

  const delibResult = analysis.delibResult;

  await models.CommentFallacyLabels.create({
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
