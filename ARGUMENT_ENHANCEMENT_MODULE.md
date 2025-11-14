# Argument Enhancement Module

## Overview

The Argument Enhancement Module is a real-time AI-powered assistant for deliberative democracy that analyzes user arguments and provides specific, actionable suggestions to improve argument quality based on Toulmin's model of argumentation.

## Implementation Details

### Backend Components

#### 1. Service: `argumentEnhancementService.cjs`
**Location:** `/home/user/your-priorities-app-fallacy-DKG/server_api/src/services/engine/moderation/argumentEnhancementService.cjs`

**Features:**
- Analyzes arguments using Toulmin's model (claim, evidence, warrant, qualifiers, backing, rebuttals)
- Provides strength assessment (weak/moderate/strong, scored 1-10)
- Generates specific, actionable suggestions
- Multilingual support
- Uses OpenRouter API with DeepSeek Chat as primary model (cost-effective, fast)
- Fallback to GPT-4o-mini if primary fails
- Temperature: 0.3 for consistent analysis
- Max tokens: 2000
- Returns structured JSON responses

**Key Methods:**
- `analyzeArgument(text, context)` - Full AI analysis
- `quickCheck(text)` - Fast, non-AI basic feedback for real-time UI updates

**Example Usage:**
```javascript
const { getService } = require('./argumentEnhancementService.cjs');
const service = getService();

const analysis = await service.analyzeArgument(
  "We should increase funding for public schools.",
  { language: 'en', discussionTopic: 'Education Policy' }
);
```

#### 2. API Endpoints: `points.cjs` controller
**Location:** `/home/user/your-priorities-app-fallacy-DKG/server_api/src/controllers/points.cjs`

**Endpoints:**

##### POST `/api/points/enhance`
Analyzes argument text and provides AI-powered suggestions.

**Request:**
```json
{
  "text": "We should increase funding for public schools.",
  "postId": 123,
  "language": "en"
}
```

**Response:**
```json
{
  "components": {
    "claim": { "present": true, "text": "We should increase...", "strength": 7 },
    "evidence": { "present": false, "text": null, "strength": 0 },
    "warrant": { "present": false, "text": null, "strength": 0 },
    "qualifiers": { "present": false, "text": null, "strength": 0 },
    "backing": { "present": false, "text": null, "strength": 0 },
    "rebuttals": { "present": false, "text": null, "strength": 0 }
  },
  "strengthScore": 3,
  "strengthLevel": "weak",
  "suggestions": [
    {
      "type": "evidence",
      "priority": "high",
      "message": "Add evidence: cite sources, data, or research to support your claim",
      "example": "According to the National Education Association, schools with higher funding show 15% better student outcomes...",
      "id": 1
    },
    {
      "type": "warrant",
      "priority": "high",
      "message": "Explain the reasoning connecting your evidence to your claim",
      "example": "Because better-funded schools can hire more qualified teachers and provide modern resources, students receive higher quality education...",
      "id": 2
    },
    {
      "type": "qualifiers",
      "priority": "medium",
      "message": "Add qualifiers to acknowledge limitations (e.g., 'in most cases', 'generally', 'typically')",
      "example": "In most urban areas, we should increase funding...",
      "id": 3
    }
  ],
  "summary": "Your argument has a clear claim but lacks supporting evidence and reasoning. Adding specific data and explaining why funding leads to better outcomes will strengthen your position.",
  "metadata": {
    "processingTime": 1850,
    "model": "deepseek/deepseek-chat",
    "textLength": 45
  }
}
```

**Rate Limiting:** 10 requests per minute per user

##### POST `/api/points/enhance/quick`
Provides instant, non-AI feedback for real-time updates as user types.

**Request:**
```json
{
  "text": "We should increase funding"
}
```

**Response:**
```json
{
  "wordCount": 4,
  "sentenceCount": 1,
  "lengthFeedback": "Your argument is quite short. Consider adding more detail.",
  "basicSuggestions": [
    "Add specific examples or evidence",
    "Consider adding reasoning (e.g., 'because...', 'for example...')"
  ]
}
```

### Frontend Components

#### 1. Component: `yp-argument-assistant.ts`
**Location:** `/home/user/your-priorities-app-fallacy-DKG/webApps/client/src/yp-post/yp-argument-assistant.ts`

**Features:**
- Material Design 3 styled component
- Shows strength indicator with visual progress bar
- Displays identified components with checkmarks
- Lists improvement suggestions with priority indicators
- Expandable/collapsible interface
- User feedback collection (helpful/not helpful)
- Auto-analysis option (debounced)
- Responsive design for mobile

**Properties:**
- `text` - The argument text to analyze
- `postId` - Context for the discussion
- `autoAnalyze` - Enable auto-analysis after typing stops (default: false)
- `autoAnalyzeDelay` - Delay before auto-analysis (default: 5000ms)

**Events:**
- `suggestion-applied` - Fired when user applies a suggestion
- `feedback-submitted` - Fired when user rates suggestions helpful/not helpful

**Example Integration:**
```html
<yp-argument-assistant
  .text="${this.userText}"
  .postId="${this.post.id}"
  @suggestion-applied="${this._onSuggestionApplied}"
  @feedback-submitted="${this._onFeedbackSubmitted}"
></yp-argument-assistant>
```

#### 2. Integration: `yp-post-points.ts`
**Location:** `/home/user/your-priorities-app-fallacy-DKG/webApps/client/src/yp-post/yp-post-points.ts`

The assistant is integrated into the comment editor, appearing automatically when users type more than 10 characters. It's positioned between the text field and submit button.

### Database

#### Table: `argument_enhancements`
**Migration:** `/home/user/your-priorities-app-fallacy-DKG/server_api/migrations/argumentEnhancements.cjs`
**Model:** `/home/user/your-priorities-app-fallacy-DKG/server_api/src/models/argumentEnhancement.cjs`

**Schema:**
```sql
CREATE TABLE argument_enhancements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  post_id INTEGER REFERENCES posts(id),
  original_text TEXT NOT NULL,
  strength_score INTEGER,
  components JSONB,
  suggestions JSONB,
  metadata JSONB,
  applied_suggestions JSONB,
  user_feedback VARCHAR,
  revised_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `user_id` - For user analytics
- `post_id` - For discussion analytics
- `created_at` - For temporal queries
- `user_feedback` - For tracking approval rates

## Example Analyses

### Example 1: Weak Argument (Climate Change)

**Input:**
```
Climate change is fake news. Everyone knows the weather changes all the time.
```

**Analysis:**
```json
{
  "components": {
    "claim": { "present": true, "text": "Climate change is fake news", "strength": 4 },
    "evidence": { "present": false, "text": null, "strength": 0 },
    "warrant": { "present": false, "text": null, "strength": 0 },
    "qualifiers": { "present": false, "text": null, "strength": 0 },
    "backing": { "present": false, "text": null, "strength": 0 },
    "rebuttals": { "present": false, "text": null, "strength": 0 }
  },
  "strengthScore": 2,
  "strengthLevel": "weak",
  "suggestions": [
    {
      "type": "evidence",
      "priority": "high",
      "message": "Support your claim with scientific evidence or credible sources",
      "example": "According to NASA's climate data from 1880-2023, global average temperatures have risen by 1.1°C...",
      "id": 1
    },
    {
      "type": "claim",
      "priority": "high",
      "message": "Clarify your main claim - distinguish between weather (short-term) and climate (long-term patterns)",
      "example": "While daily weather varies, climate refers to long-term atmospheric patterns over decades...",
      "id": 2
    },
    {
      "type": "rebuttals",
      "priority": "medium",
      "message": "Acknowledge counterarguments from climate scientists and explain why you disagree",
      "example": "While 97% of climate scientists agree on human-caused warming, I believe...",
      "id": 3
    }
  ],
  "summary": "Your argument confuses weather with climate and lacks scientific evidence. To strengthen your position, distinguish between short-term weather and long-term climate patterns, and cite credible scientific sources."
}
```

### Example 2: Moderate Argument (Public Transportation)

**Input:**
```
Our city should invest in light rail because traffic congestion costs us millions in lost productivity. Studies show that cities with good public transit have less pollution and happier residents. However, the initial cost is high and would require raising taxes.
```

**Analysis:**
```json
{
  "components": {
    "claim": { "present": true, "text": "Our city should invest in light rail", "strength": 9 },
    "evidence": { "present": true, "text": "traffic congestion costs us millions... Studies show...", "strength": 6 },
    "warrant": { "present": true, "text": "because traffic congestion costs us millions", "strength": 7 },
    "qualifiers": { "present": false, "text": null, "strength": 0 },
    "backing": { "present": false, "text": null, "strength": 0 },
    "rebuttals": { "present": true, "text": "However, the initial cost is high...", "strength": 8 }
  },
  "strengthScore": 6,
  "strengthLevel": "moderate",
  "suggestions": [
    {
      "type": "evidence",
      "priority": "high",
      "message": "Strengthen your evidence by citing specific studies or data",
      "example": "A 2022 study by the Transportation Research Board found that cities with light rail saw 23% reduction in congestion...",
      "id": 1
    },
    {
      "type": "backing",
      "priority": "medium",
      "message": "Add backing for your warrant - explain how reduced congestion translates to productivity",
      "example": "When commuters spend less time in traffic, they arrive at work less stressed and more focused, increasing productivity by an estimated 8-12% according to workplace studies...",
      "id": 2
    },
    {
      "type": "qualifiers",
      "priority": "low",
      "message": "Add qualifiers to show nuanced thinking",
      "example": "In most metropolitan areas over 500,000 people, light rail investments have shown positive returns...",
      "id": 3
    }
  ],
  "summary": "Your argument is well-structured with a clear claim, some evidence, and acknowledgment of counterarguments. To make it stronger, cite specific studies and explain the mechanism by which reduced congestion improves productivity."
}
```

## Testing Strategy

### 1. Unit Tests

**Service Tests** (`argumentEnhancementService.test.js`):
```javascript
describe('ArgumentEnhancementService', () => {
  test('analyzes short arguments', async () => {
    const result = await service.analyzeArgument("Too short");
    expect(result.error).toBeDefined();
  });

  test('identifies missing components', async () => {
    const result = await service.analyzeArgument("We should do X.");
    expect(result.components.evidence.present).toBe(false);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  test('handles multilingual input', async () => {
    const result = await service.analyzeArgument(
      "Necesitamos más educación",
      { language: 'es' }
    );
    expect(result.strengthScore).toBeDefined();
  });

  test('quick check provides basic feedback', () => {
    const feedback = service.quickCheck("This is a very long argument...");
    expect(feedback.wordCount).toBeGreaterThan(5);
    expect(feedback.lengthFeedback).toBeDefined();
  });
});
```

**API Tests** (`points.enhance.test.js`):
```javascript
describe('POST /api/points/enhance', () => {
  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/points/enhance')
      .send({ text: 'Test' });
    expect(res.status).toBe(401);
  });

  test('validates input', async () => {
    const res = await request(app)
      .post('/api/points/enhance')
      .set('Authorization', token)
      .send({ text: '' });
    expect(res.status).toBe(400);
  });

  test('returns analysis', async () => {
    const res = await request(app)
      .post('/api/points/enhance')
      .set('Authorization', token)
      .send({
        text: 'We should increase education funding.',
        postId: 1
      });
    expect(res.status).toBe(200);
    expect(res.body.strengthScore).toBeDefined();
    expect(res.body.suggestions).toBeInstanceOf(Array);
  });

  test('enforces rate limiting', async () => {
    // Make 11 requests in rapid succession
    for (let i = 0; i < 11; i++) {
      await request(app)
        .post('/api/points/enhance')
        .set('Authorization', token)
        .send({ text: 'Test ' + i });
    }
    // 11th request should be rate limited
    const res = await request(app)
      .post('/api/points/enhance')
      .set('Authorization', token)
      .send({ text: 'Test 11' });
    expect(res.status).toBe(429);
  });
});
```

### 2. Integration Tests

**Frontend Integration** (`yp-argument-assistant.test.js`):
```javascript
describe('yp-argument-assistant', () => {
  test('renders with text', async () => {
    const el = await fixture(html`
      <yp-argument-assistant
        text="Test argument">
      </yp-argument-assistant>
    `);
    expect(el.shadowRoot.querySelector('.container')).to.exist;
  });

  test('triggers analysis on button click', async () => {
    const el = await fixture(html`
      <yp-argument-assistant text="Test">
      </yp-argument-assistant>
    `);
    const button = el.shadowRoot.querySelector('md-outlined-button');
    button.click();
    await el.updateComplete;
    expect(el.isAnalyzing).to.be.true;
  });

  test('emits suggestion-applied event', async () => {
    const el = await fixture(html`
      <yp-argument-assistant text="Test">
      </yp-argument-assistant>
    `);
    let eventFired = false;
    el.addEventListener('suggestion-applied', () => {
      eventFired = true;
    });
    el.applySuggestion({ id: 1, message: 'Test' });
    expect(eventFired).to.be.true;
  });
});
```

### 3. Performance Tests

**Response Time:**
- Target: <2 seconds for analysis
- Monitor: `metadata.processingTime` in responses
- Alert if p95 > 3000ms

**Load Testing:**
```bash
# Apache Bench - simulate 100 concurrent users
ab -n 1000 -c 100 -H "Authorization: Bearer $TOKEN" \
   -p request.json \
   -T application/json \
   http://localhost:8080/api/points/enhance
```

**Expected Results:**
- 99% success rate
- Mean response time <2s
- No 500 errors
- Rate limiter correctly blocks >10 req/min per user

### 4. User Acceptance Testing

**Metrics to Track:**
- User approval rate: >60% target (helpful/total feedback)
- Suggestion application rate: % of suggestions users click
- Time to analysis: <2s target
- Error rate: <1%
- Multilingual support: Test in top 5 languages

**A/B Testing:**
- Group A: With argument assistant
- Group B: Without argument assistant
- Measure:
  - Average argument length
  - Use of evidence markers ("because", "according to")
  - Engagement (time spent writing)
  - Quality scores from other users

### 5. Manual Test Cases

**Test Case 1: Basic Flow**
1. Navigate to post with debate enabled
2. Type "We should do X" in comment box (>10 chars)
3. Verify assistant appears
4. Click "Get AI Suggestions"
5. Verify analysis loads in <2s
6. Verify strength score displayed
7. Verify suggestions list shown
8. Click "Helpful" feedback
9. Verify event tracked

**Test Case 2: Auto-Analysis**
1. Enable auto-analysis (if feature added)
2. Type slowly in text box
3. Stop typing for 5+ seconds
4. Verify analysis triggers automatically
5. Continue typing
6. Verify analysis is debounced (doesn't re-trigger immediately)

**Test Case 3: Rate Limiting**
1. Click "Get AI Suggestions" 10 times rapidly
2. Verify all succeed
3. Click 11th time
4. Verify error message about rate limit
5. Wait 1 minute
6. Try again - should succeed

**Test Case 4: Multilingual**
1. Type argument in Spanish
2. Trigger analysis
3. Verify suggestions in Spanish
4. Repeat for French, German, Chinese

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=your_openrouter_api_key

# Optional
OPENAI_BASE_URL=https://openrouter.ai/api/v1
ARGUMENT_ENHANCEMENT_MODEL=deepseek/deepseek-chat
RATE_LIMITER_WINDOW_MS=60000
RATE_LIMITER_MAX=10
```

### Feature Flags

To enable/disable the argument assistant per group:
```javascript
// In group configuration
{
  "enableArgumentAssistant": true,
  "argumentAssistantAutoAnalyze": false,
  "argumentAssistantDelay": 5000
}
```

## Analytics & Monitoring

### Key Metrics Dashboard

1. **Usage Metrics**
   - Daily active users of assistant
   - Analyses per day
   - Average analyses per user
   - Peak usage times

2. **Quality Metrics**
   - Average strength score (before/after suggestions)
   - Distribution of strength levels (weak/moderate/strong)
   - Most common missing components
   - Suggestion application rate by type

3. **Performance Metrics**
   - Average response time
   - P50, P95, P99 latency
   - Error rate
   - Rate limit hits

4. **User Satisfaction**
   - Helpful vs. not helpful ratio
   - Target: >60% helpful
   - Feedback comments (if collected)

### Database Queries for Analytics

```sql
-- User approval rate
SELECT
  COUNT(CASE WHEN user_feedback = 'helpful' THEN 1 END)::float /
  COUNT(*) as approval_rate
FROM argument_enhancements
WHERE user_feedback IS NOT NULL;

-- Average strength by component presence
SELECT
  CASE WHEN (components->>'claim')::jsonb->>'present' = 'true'
    THEN 'Has Claim' ELSE 'No Claim' END as has_claim,
  AVG(strength_score) as avg_strength
FROM argument_enhancements
GROUP BY has_claim;

-- Most common suggestions
SELECT
  suggestion->>'type' as suggestion_type,
  COUNT(*) as count
FROM argument_enhancements,
  jsonb_array_elements(suggestions) as suggestion
GROUP BY suggestion_type
ORDER BY count DESC;

-- Processing time trends
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  AVG((metadata->>'processingTime')::int) as avg_time_ms,
  MAX((metadata->>'processingTime')::int) as max_time_ms
FROM argument_enhancements
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

## Future Enhancements

1. **Suggestion Templates**
   - One-click to insert suggestion examples
   - Template library for common argument patterns
   - Custom templates per discussion topic

2. **Learning from Feedback**
   - Use user feedback to fine-tune prompts
   - Track which suggestions users find most helpful
   - A/B test different suggestion phrasings

3. **Collaborative Features**
   - Show anonymized strength scores of other arguments
   - Highlight well-argued points as examples
   - Peer review suggestions

4. **Advanced Analysis**
   - Detect logical fallacies
   - Identify bias or emotional language
   - Suggest balanced phrasing
   - Check fact claims against knowledge base

5. **Gamification**
   - Award badges for strong arguments
   - Track improvement over time
   - Leaderboard for most helpful contributors

## Support & Troubleshooting

### Common Issues

**Issue: "Too many requests" error**
- Cause: Rate limit exceeded (>10 req/min)
- Solution: Wait 1 minute before trying again
- Prevention: Don't spam the analyze button

**Issue: Analysis taking >10 seconds**
- Cause: API timeout or high load
- Solution: Retry the request
- Check: OpenRouter API status

**Issue: Suggestions in wrong language**
- Cause: Language not detected correctly
- Solution: Pass explicit `language` parameter
- Example: `{ text: "...", language: "es" }`

**Issue: Low quality suggestions**
- Cause: Argument too short or unclear
- Solution: Write more detailed argument (>20 words)
- Include: Claim + reasoning + evidence

### Debug Mode

Enable verbose logging:
```javascript
// In argumentEnhancementService.cjs
const DEBUG = true;
```

This will log:
- Full prompts sent to AI
- Raw AI responses
- Processing times
- Error stack traces

## License & Attribution

This module implements the "Argument Enhancement Module" described in Section IV.B.2 of the research paper on deliberative democracy platforms.

Based on Toulmin's model of argumentation:
- Toulmin, S. (2003). The Uses of Argument. Cambridge University Press.

AI models used:
- Primary: DeepSeek Chat (via OpenRouter)
- Fallback: GPT-4o-mini (via OpenRouter)

## Contact

For questions or issues:
- GitHub Issues: [your-repo]/issues
- Email: support@yourpriorities.org
- Documentation: https://docs.yourpriorities.org/argument-enhancement
