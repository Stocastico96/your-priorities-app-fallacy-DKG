const log = require("../../../utils/logger.cjs");

/**
 * Educational Feedback Educator for Fallacy Detection
 * Provides comprehensive, constructive, and non-judgmental educational content
 * for 13 fallacy types based on Jin et al. [24]
 */

const FALLACY_EDUCATION = {
  ad_hominem: {
    name: "Ad Hominem",
    definition: "An ad hominem fallacy attacks the person making the argument rather than addressing the argument itself. This diverts attention from the actual issue being discussed.",
    why_problematic: "It prevents productive dialogue by focusing on personal characteristics instead of evaluating the merits of ideas and evidence.",
    how_to_improve: [
      "Focus on the argument's content, logic, and evidence rather than the person presenting it",
      "Address specific points made in the argument with counter-evidence or logical reasoning",
      "If you disagree with someone's credibility, explain why their specific claims are questionable with facts"
    ],
    better_example: {
      before: "You can't trust John's economic proposal because he's not an economist.",
      after: "John's economic proposal has some issues. For example, it doesn't account for inflation effects on consumer spending, as shown in recent studies."
    },
    resource_link: "https://en.wikipedia.org/wiki/Ad_hominem",
    severity: "medium"
  },

  ad_populum: {
    name: "Ad Populum (Appeal to Popularity)",
    definition: "This fallacy assumes something is true or good simply because many people believe it. Popularity is used as evidence rather than actual facts or logic.",
    why_problematic: "Truth and quality are not determined by popularity; many widely-held beliefs throughout history have been proven wrong.",
    how_to_improve: [
      "Support your claims with evidence, research, or logical reasoning rather than citing popularity",
      "Acknowledge that while something may be popular, this doesn't make it correct or optimal",
      "Look for objective data, expert analysis, or empirical evidence to support your position"
    ],
    better_example: {
      before: "Everyone knows that this policy works, so we should implement it.",
      after: "Research from three independent studies shows this policy reduces costs by 15% while maintaining quality, which is why I recommend implementation."
    },
    resource_link: "https://en.wikipedia.org/wiki/Argumentum_ad_populum",
    severity: "medium"
  },

  false_causality: {
    name: "False Causality (Post Hoc)",
    definition: "This fallacy assumes that because one event followed another, the first event caused the second. It confuses correlation with causation.",
    why_problematic: "It leads to incorrect conclusions about cause-and-effect relationships, potentially resulting in ineffective or harmful solutions.",
    how_to_improve: [
      "Distinguish between correlation and causation by looking for additional evidence",
      "Consider alternative explanations and confounding variables",
      "Cite controlled studies or research that establishes causal relationships, not just timing"
    ],
    better_example: {
      before: "Crime decreased after the new mayor took office, so their policies must be working.",
      after: "Crime decreased after the new mayor took office. However, we should also consider other factors like economic improvements, demographic changes, and ongoing programs from the previous administration."
    },
    resource_link: "https://en.wikipedia.org/wiki/Post_hoc_ergo_propter_hoc",
    severity: "high"
  },

  circular_reasoning: {
    name: "Circular Reasoning",
    definition: "This fallacy occurs when the conclusion of an argument is used as a premise of that same argument. The argument assumes what it's trying to prove.",
    why_problematic: "It provides no actual evidence or logical progression, making the argument meaningless and unconvincing.",
    how_to_improve: [
      "Provide independent evidence or premises that support your conclusion",
      "Build your argument from established facts or accepted principles",
      "Ensure your reasoning progresses logically from evidence to conclusion, not in a circle"
    ],
    better_example: {
      before: "This law is fair because it treats everyone fairly.",
      after: "This law is fair because it applies the same standards to all citizens regardless of background, and similar laws have resulted in more equitable outcomes in other jurisdictions."
    },
    resource_link: "https://en.wikipedia.org/wiki/Circular_reasoning",
    severity: "high"
  },

  straw_man: {
    name: "Straw Man",
    definition: "This fallacy misrepresents or oversimplifies an opponent's argument to make it easier to attack. It involves arguing against a distorted version of the actual position.",
    why_problematic: "It prevents genuine engagement with the real issues and creates unnecessary division by attacking positions people don't actually hold.",
    how_to_improve: [
      "Accurately represent the opposing viewpoint before critiquing it",
      "Consider asking clarifying questions to ensure you understand the position correctly",
      "Address the strongest version of the opposing argument, not the weakest interpretation"
    ],
    better_example: {
      before: "My opponent wants to reduce military spending, which means they don't care about national security.",
      after: "My opponent proposes reducing military spending by 10%. While I understand the goal of fiscal responsibility, I'm concerned about maintaining our current defense capabilities. Here's why..."
    },
    resource_link: "https://en.wikipedia.org/wiki/Straw_man",
    severity: "high"
  },

  false_dilemma: {
    name: "False Dilemma (False Dichotomy)",
    definition: "This fallacy presents only two options when more possibilities exist. It oversimplifies complex situations into an either/or choice.",
    why_problematic: "It limits creative problem-solving and prevents consideration of nuanced or compromise solutions.",
    how_to_improve: [
      "Acknowledge the full range of available options or positions",
      "Explore middle-ground solutions or alternative approaches",
      "Present the options you're comparing while noting that others may exist"
    ],
    better_example: {
      before: "We must either cut all environmental regulations or accept economic collapse.",
      after: "We need to balance environmental protection with economic growth. Options include targeted regulations, incentive programs for green technology, gradual transitions, and support for affected industries."
    },
    resource_link: "https://en.wikipedia.org/wiki/False_dilemma",
    severity: "medium"
  },

  appeal_to_authority: {
    name: "Appeal to Authority",
    definition: "This fallacy relies on the opinion of an authority figure as the sole evidence, especially when that authority is not an expert in the relevant field.",
    why_problematic: "Expert opinion should inform arguments, but it's not infallible and should be supported by reasoning and evidence.",
    how_to_improve: [
      "Cite relevant experts and also provide the reasoning or evidence behind their conclusions",
      "Ensure the authority is actually an expert in the specific field being discussed",
      "Present multiple expert opinions when there's disagreement in the field"
    ],
    better_example: {
      before: "A famous actor said this diet works, so it must be effective.",
      after: "According to nutritionists at Harvard Medical School, this diet has been shown in peer-reviewed studies to improve metabolic markers because it balances macronutrients effectively."
    },
    resource_link: "https://en.wikipedia.org/wiki/Argument_from_authority",
    severity: "low"
  },

  slippery_slope: {
    name: "Slippery Slope",
    definition: "This fallacy argues that one action will inevitably lead to a chain of events resulting in an extreme outcome, without providing evidence for this chain of causation.",
    why_problematic: "It uses fear of hypothetical consequences rather than addressing the actual merits or risks of the immediate action.",
    how_to_improve: [
      "Focus on the direct, demonstrable consequences of the proposed action",
      "If warning about potential risks, provide evidence that each step in the chain is likely",
      "Distinguish between possible, probable, and inevitable outcomes"
    ],
    better_example: {
      before: "If we allow people to work from home one day a week, soon no one will come to the office and the company will collapse.",
      after: "Allowing one work-from-home day per week could affect team collaboration. We should pilot it with one department, measure productivity and satisfaction, and adjust based on results."
    },
    resource_link: "https://en.wikipedia.org/wiki/Slippery_slope",
    severity: "medium"
  },

  hasty_generalization: {
    name: "Hasty Generalization",
    definition: "This fallacy draws a broad conclusion from a small or unrepresentative sample. It rushes to judgment without sufficient evidence.",
    why_problematic: "It leads to stereotyping and inaccurate conclusions that don't reflect the full complexity of reality.",
    how_to_improve: [
      "Base conclusions on adequate sample sizes and representative data",
      "Acknowledge the limits of your experience or evidence",
      "Use qualifiers like 'some,' 'many,' or 'in my limited experience' when appropriate"
    ],
    better_example: {
      before: "I met two rude people from that city, so everyone there must be unfriendly.",
      after: "In my limited interactions, I encountered some unfriendly people in that city, but I recognize this is not representative of the entire population."
    },
    resource_link: "https://en.wikipedia.org/wiki/Hasty_generalization",
    severity: "medium"
  },

  red_herring: {
    name: "Red Herring",
    definition: "This fallacy introduces an irrelevant topic to divert attention from the original issue being discussed.",
    why_problematic: "It derails productive discussion and prevents resolution of the actual issue at hand.",
    how_to_improve: [
      "Stay focused on the topic being discussed",
      "If bringing up a related issue, clearly explain its relevance to the main topic",
      "Address the central question before exploring tangential matters"
    ],
    better_example: {
      before: "You criticize my environmental record, but what about your economic policies?",
      after: "I'd like to address concerns about my environmental record directly. My policies have reduced emissions by 15% while creating 5,000 green jobs. I'm happy to discuss economic policies separately."
    },
    resource_link: "https://en.wikipedia.org/wiki/Red_herring",
    severity: "medium"
  },

  tu_quoque: {
    name: "Tu Quoque (You Too)",
    definition: "This fallacy dismisses criticism by pointing out that the critic is guilty of the same thing, rather than addressing the criticism itself.",
    why_problematic: "Two wrongs don't make a right; the validity of criticism doesn't depend on whether the critic is perfect.",
    how_to_improve: [
      "Address the substance of the criticism directly",
      "Acknowledge if there's truth to the criticism regardless of who's making it",
      "If bringing up the other person's behavior, do so in addition to, not instead of, addressing the issue"
    ],
    better_example: {
      before: "You can't criticize my spending when you overspent last year too.",
      after: "You raise a valid concern about my spending. I've reviewed the budget and identified three areas where we can reduce costs by 20%. I'd welcome your input on the plan."
    },
    resource_link: "https://en.wikipedia.org/wiki/Tu_quoque",
    severity: "low"
  },

  no_true_scotsman: {
    name: "No True Scotsman",
    definition: "This fallacy dismisses counterexamples to a universal claim by redefining the criteria to exclude them, rather than acknowledging exceptions.",
    why_problematic: "It prevents honest discussion by arbitrarily changing definitions to protect one's position from criticism.",
    how_to_improve: [
      "Acknowledge genuine counterexamples to your claims",
      "Use precise language and clear criteria from the start",
      "Modify your position to accommodate new information rather than redefining terms"
    ],
    better_example: {
      before: "No true environmentalist would oppose this policy." (when shown environmentalists who oppose it) "Well, they're not real environmentalists then.",
      after: "Most environmentalists support this policy, though some have raised concerns about its implementation timeline. These concerns deserve consideration."
    },
    resource_link: "https://en.wikipedia.org/wiki/No_true_Scotsman",
    severity: "low"
  },

  burden_of_proof: {
    name: "Burden of Proof",
    definition: "This fallacy occurs when someone makes a claim but expects others to disprove it rather than providing evidence for it themselves.",
    why_problematic: "It's impossible to prove a negative; the person making a claim is responsible for supporting it with evidence.",
    how_to_improve: [
      "Provide evidence for your own claims rather than demanding others disprove them",
      "Support positive assertions with data, research, or logical reasoning",
      "Acknowledge that absence of disproof is not the same as proof"
    ],
    better_example: {
      before: "This program is effective; prove that it isn't!",
      after: "This program has been effective based on these metrics: participant satisfaction increased 30%, and cost per outcome decreased 15% according to our evaluation study."
    },
    resource_link: "https://en.wikipedia.org/wiki/Burden_of_proof_(philosophy)",
    severity: "medium"
  }
};

/**
 * Generate comprehensive educational feedback for a detected fallacy
 *
 * @param {string} fallacyType - Type of fallacy detected (e.g., 'ad_hominem')
 * @param {string} commentText - The original comment text
 * @param {number} confidence - Confidence score (0-1)
 * @returns {object} Educational feedback object
 */
function generateEducationalFeedback(fallacyType, commentText, confidence) {
  try {
    const fallacy = FALLACY_EDUCATION[fallacyType];

    if (!fallacy) {
      log.warn("Unknown fallacy type requested", { fallacyType });
      return {
        fallacyType,
        error: "Unknown fallacy type",
        confidence: confidence || 0
      };
    }

    // Calculate confidence percentage
    const confidencePercent = Math.round((confidence || 0) * 100);

    // Determine tone based on confidence
    let tone = "gentle";
    if (confidencePercent >= 85) {
      tone = "clear";
    } else if (confidencePercent >= 70) {
      tone = "moderate";
    }

    // Create educational feedback
    const feedback = {
      fallacyType,
      fallacyName: fallacy.name,
      confidence: confidencePercent,
      confidenceLevel: getConfidenceLevel(confidencePercent),
      severity: fallacy.severity,

      // Educational content
      definition: fallacy.definition,
      whyProblematic: fallacy.why_problematic,
      howToImprove: fallacy.how_to_improve,
      betterExample: fallacy.better_example,
      resourceLink: fallacy.resource_link,

      // Constructive message based on confidence
      message: generateConstructiveMessage(fallacy, tone, confidencePercent),

      // Metadata
      generatedAt: new Date().toISOString(),
      educationalVersion: "1.0"
    };

    log.info("Generated educational feedback", {
      fallacyType,
      confidence: confidencePercent
    });

    return feedback;
  } catch (error) {
    log.error("Error generating educational feedback", { error, fallacyType });
    return {
      fallacyType,
      error: "Failed to generate feedback",
      confidence: 0
    };
  }
}

/**
 * Get confidence level category
 */
function getConfidenceLevel(confidencePercent) {
  if (confidencePercent >= 85) return "high";
  if (confidencePercent >= 70) return "medium";
  if (confidencePercent >= 50) return "low";
  return "very_low";
}

/**
 * Generate a constructive, non-judgmental message
 */
function generateConstructiveMessage(fallacy, tone, confidence) {
  const baseMessage = `This comment may contain a ${fallacy.name} fallacy`;

  if (tone === "clear" && confidence >= 85) {
    return `${baseMessage}. ${fallacy.definition} Consider revising your argument to focus on evidence and reasoning.`;
  } else if (tone === "moderate" && confidence >= 70) {
    return `${baseMessage}. This pattern sometimes indicates ${fallacy.name}. ${fallacy.definition} You might strengthen your argument by ${fallacy.how_to_improve[0].toLowerCase()}.`;
  } else {
    return `${baseMessage}, though this detection has lower confidence. ${fallacy.definition} If this applies, consider ${fallacy.how_to_improve[0].toLowerCase()}.`;
  }
}

/**
 * Get all available fallacy types with basic info
 */
function getAllFallacyTypes() {
  return Object.keys(FALLACY_EDUCATION).map(type => ({
    type,
    name: FALLACY_EDUCATION[type].name,
    severity: FALLACY_EDUCATION[type].severity
  }));
}

/**
 * Get educational content for a specific fallacy type
 */
function getFallacyEducation(fallacyType) {
  return FALLACY_EDUCATION[fallacyType] || null;
}

/**
 * Validate if a fallacy type is supported
 */
function isSupportedFallacy(fallacyType) {
  return fallacyType in FALLACY_EDUCATION;
}

module.exports = {
  generateEducationalFeedback,
  getAllFallacyTypes,
  getFallacyEducation,
  isSupportedFallacy,
  FALLACY_EDUCATION
};
