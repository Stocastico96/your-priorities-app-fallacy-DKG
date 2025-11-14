/**
 * Example Usage of Fallacy Educator Service
 * Demonstrates how to use the educational feedback system
 */

const fallacyEducator = require('./fallacyEducator.cjs');
const delibAiService = require('./delibAiService.cjs');

// ============================================================================
// Example 1: Generate Educational Feedback for a Specific Fallacy
// ============================================================================

console.log('\n=== Example 1: Generate Educational Feedback ===\n');

const feedback1 = fallacyEducator.generateEducationalFeedback(
  'ad_hominem',
  'You cannot trust what John says because he is not an expert.',
  0.87
);

console.log('Fallacy Type:', feedback1.fallacyType);
console.log('Fallacy Name:', feedback1.fallacyName);
console.log('Confidence:', feedback1.confidence + '%');
console.log('Confidence Level:', feedback1.confidenceLevel);
console.log('\nDefinition:', feedback1.definition);
console.log('\nWhy Problematic:', feedback1.whyProblematic);
console.log('\nHow to Improve:');
feedback1.howToImprove.forEach((tip, i) => {
  console.log(`  ${i + 1}. ${tip}`);
});
console.log('\nBetter Example:');
console.log('  Before:', feedback1.betterExample.before);
console.log('  After:', feedback1.betterExample.after);
console.log('\nLearn More:', feedback1.resourceLink);

// ============================================================================
// Example 2: Get All Available Fallacy Types
// ============================================================================

console.log('\n\n=== Example 2: All Available Fallacy Types ===\n');

const allTypes = fallacyEducator.getAllFallacyTypes();
console.log(`Total fallacy types: ${allTypes.length}\n`);

allTypes.forEach(type => {
  console.log(`- ${type.name} (${type.type}) - Severity: ${type.severity}`);
});

// ============================================================================
// Example 3: Analyze a Comment for Fallacies
// ============================================================================

console.log('\n\n=== Example 3: Analyze Comment for Fallacies ===\n');

async function analyzeCommentExample() {
  const commentText = "Everyone knows that this policy works, so we should implement it. Besides, the opposition leader is corrupt anyway.";

  try {
    const analysis = await delibAiService.analyzeFallaciesInComment(
      commentText,
      null, // No commentId (won't store in DB)
      {
        language: 'en',
        storeInDatabase: false // Don't store for this example
      }
    );

    console.log('Comment:', commentText);
    console.log('\nFallacies Detected:', analysis.fallaciesDetected);
    console.log('Total Detections:', analysis.count);

    if (analysis.fallaciesDetected) {
      analysis.detections.forEach((detection, i) => {
        console.log(`\n--- Detection ${i + 1} ---`);
        console.log('Type:', detection.fallacyType);
        console.log('Confidence:', (detection.confidence * 100).toFixed(1) + '%');
        console.log('Educational Message:', detection.educationalFeedback.message);
      });
    }
  } catch (error) {
    console.error('Error analyzing comment:', error);
  }
}

analyzeCommentExample();

// ============================================================================
// Example 4: Different Confidence Levels
// ============================================================================

console.log('\n\n=== Example 4: Different Confidence Levels ===\n');

const confidenceLevels = [
  { level: 'High', score: 0.95 },
  { level: 'Medium', score: 0.75 },
  { level: 'Low', score: 0.55 }
];

confidenceLevels.forEach(({ level, score }) => {
  const feedback = fallacyEducator.generateEducationalFeedback(
    'straw_man',
    'Example text',
    score
  );

  console.log(`\n${level} Confidence (${feedback.confidence}%):`);
  console.log('Message:', feedback.message);
  console.log('Confidence Level:', feedback.confidenceLevel);
});

// ============================================================================
// Example 5: Educational Content for Each Fallacy Type
// ============================================================================

console.log('\n\n=== Example 5: Sample Educational Content ===\n');

const sampleFallacies = ['ad_hominem', 'false_causality', 'straw_man'];

sampleFallacies.forEach(type => {
  const education = fallacyEducator.getFallacyEducation(type);

  console.log(`\n--- ${education.name} ---`);
  console.log('Definition:', education.definition);
  console.log('Severity:', education.severity);
  console.log('Example - Before:', education.better_example.before);
  console.log('Example - After:', education.better_example.after);
  console.log('Resource:', education.resource_link);
});

// ============================================================================
// Example 6: Validate Fallacy Types
// ============================================================================

console.log('\n\n=== Example 6: Validate Fallacy Types ===\n');

const testTypes = ['ad_hominem', 'invalid_type', 'straw_man', 'fake_fallacy'];

testTypes.forEach(type => {
  const isValid = fallacyEducator.isSupportedFallacy(type);
  console.log(`${type}: ${isValid ? '✓ Valid' : '✗ Invalid'}`);
});

// ============================================================================
// Example 7: Complete Workflow
// ============================================================================

console.log('\n\n=== Example 7: Complete Workflow ===\n');

async function completeWorkflowExample() {
  console.log('1. User submits a comment with potential fallacy...');

  const userComment = {
    id: 12345,
    content: "We must either accept all regulations or have complete economic collapse.",
    userId: 67890
  };

  console.log(`   Comment: "${userComment.content}"\n`);

  console.log('2. System analyzes comment for fallacies...');

  const analysis = await delibAiService.analyzeFallaciesInComment(
    userComment.content,
    userComment.id,
    {
      userId: userComment.userId,
      language: 'en',
      storeInDatabase: false // Set to true in production
    }
  );

  console.log(`   Fallacies detected: ${analysis.count}\n`);

  if (analysis.fallaciesDetected) {
    analysis.detections.forEach((detection, i) => {
      console.log(`3. Display educational feedback for detection ${i + 1}:`);
      const edu = detection.educationalFeedback;
      console.log(`   Type: ${edu.fallacyName}`);
      console.log(`   Confidence: ${edu.confidence}%`);
      console.log(`   Message: ${edu.message}`);
      console.log(`   How to improve:`);
      edu.howToImprove.slice(0, 2).forEach(tip => {
        console.log(`     • ${tip}`);
      });
      console.log();
    });

    console.log('4. User can provide feedback on helpfulness...');
    console.log('   [User clicks "Yes" or "No"]');
    console.log();

    console.log('5. User can click to learn more...');
    const firstDetection = analysis.detections[0];
    console.log(`   Resource: ${firstDetection.educationalFeedback.resourceLink}`);
  } else {
    console.log('   No fallacies detected. Comment quality is good!');
  }
}

completeWorkflowExample();

// ============================================================================
// Example Output Reference
// ============================================================================

console.log('\n\n=== Educational Feedback Object Structure ===\n');
console.log(`
{
  fallacyType: string,        // e.g., "ad_hominem"
  fallacyName: string,        // e.g., "Ad Hominem"
  confidence: number,         // 0-100
  confidenceLevel: string,    // "high" | "medium" | "low" | "very_low"
  severity: string,           // "high" | "medium" | "low"
  definition: string,         // Clear explanation
  whyProblematic: string,     // Impact on discourse
  howToImprove: string[],     // 3 actionable tips
  betterExample: {
    before: string,           // Problematic example
    after: string             // Improved version
  },
  resourceLink: string,       // External resource
  message: string,            // Constructive message
  generatedAt: string,        // ISO timestamp
  educationalVersion: string  // Version tracking
}
`);

console.log('\n=== End of Examples ===\n');
