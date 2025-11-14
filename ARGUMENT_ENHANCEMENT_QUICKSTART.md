# Argument Enhancement Module - Quick Start Guide

## Overview
Real-time AI assistant that helps users write better arguments in deliberative democracy discussions using Toulmin's argumentation model.

## Key Features
- ✅ Analyzes argument structure (claim, evidence, warrant, etc.)
- ✅ Provides specific, actionable suggestions
- ✅ Strength scoring (1-10, weak/moderate/strong)
- ✅ Multilingual support
- ✅ Rate limited (10 req/min per user)
- ✅ <2 second response time
- ✅ Non-intrusive UI with expand/collapse
- ✅ User feedback collection
- ✅ Database tracking for analytics

## File Structure

```
server_api/
├── src/
│   ├── controllers/
│   │   └── points.cjs                          # API endpoints (enhanced)
│   ├── services/
│   │   └── engine/
│   │       └── moderation/
│   │           └── argumentEnhancementService.cjs  # Core service
│   └── models/
│       └── argumentEnhancement.cjs             # Database model
└── migrations/
    └── argumentEnhancements.cjs                # Database schema

webApps/client/src/
└── yp-post/
    ├── yp-argument-assistant.ts                # UI component
    └── yp-post-points.ts                       # Integration (enhanced)
```

## Quick Setup

### 1. Environment Variables
```bash
# Add to .env file
OPENAI_API_KEY=your_openrouter_api_key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
ARGUMENT_ENHANCEMENT_MODEL=deepseek/deepseek-chat
```

### 2. Run Migration
```bash
cd server_api
npm run migrate
```

### 3. Build Frontend
```bash
cd webApps/client
npm run build
```

### 4. Test the API
```bash
curl -X POST http://localhost:8080/api/points/enhance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "We should invest more in renewable energy.",
    "postId": 1
  }'
```

## API Usage

### Full Analysis
```javascript
// POST /api/points/enhance
const response = await fetch('/api/points/enhance', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: "Your argument text here",
    postId: 123,  // optional
    language: "en"  // optional
  })
});

const analysis = await response.json();
/*
{
  strengthScore: 6,
  strengthLevel: "moderate",
  components: { claim: {...}, evidence: {...}, ... },
  suggestions: [
    {
      type: "evidence",
      priority: "high",
      message: "Add evidence: cite sources...",
      example: "According to...",
      id: 1
    }
  ],
  summary: "Your argument has...",
  metadata: { processingTime: 1850, model: "deepseek-chat" }
}
*/
```

### Quick Check (No AI)
```javascript
// POST /api/points/enhance/quick
const response = await fetch('/api/points/enhance/quick', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: "Short text" })
});

const feedback = await response.json();
/*
{
  wordCount: 2,
  sentenceCount: 1,
  lengthFeedback: "Your argument is quite short...",
  basicSuggestions: ["Add specific examples..."]
}
*/
```

## Frontend Usage

### Basic Integration
```html
<yp-argument-assistant
  .text="${this.userInputText}"
  .postId="${this.currentPostId}"
  @suggestion-applied="${this.handleSuggestion}"
  @feedback-submitted="${this.handleFeedback}"
></yp-argument-assistant>
```

### With Auto-Analysis
```html
<yp-argument-assistant
  .text="${this.userInputText}"
  .postId="${this.currentPostId}"
  autoAnalyze
  .autoAnalyzeDelay="${3000}"
></yp-argument-assistant>
```

### Event Handling
```typescript
handleSuggestion(event: CustomEvent) {
  const suggestion = event.detail;
  console.log('User applied:', suggestion.message);
  // Could insert suggestion template into text field
}

handleFeedback(event: CustomEvent) {
  const { helpful, analysis } = event.detail;
  console.log('Feedback:', helpful ? 'Helpful' : 'Not helpful');
  // Track for analytics
}
```

## Example Analyses

### Weak Argument
**Input:** "Climate change is fake."

**Output:**
- Strength: 1/10 (weak)
- Missing: evidence, warrant, qualifiers
- Suggestions:
  1. Add scientific evidence
  2. Clarify your claim
  3. Acknowledge counterarguments

### Moderate Argument
**Input:** "We should invest in public transit because traffic congestion costs millions. Studies show cities with good transit have less pollution."

**Output:**
- Strength: 6/10 (moderate)
- Has: claim, some evidence, basic warrant
- Missing: specific citations, qualifiers
- Suggestions:
  1. Cite specific studies
  2. Add backing for your reasoning
  3. Include qualifiers ("in most cities")

### Strong Argument
**Input:** "According to the 2023 Transportation Board study, cities with light rail saw 23% reduction in congestion, saving an average of $1.2B annually. While initial costs are high ($500M-2B), the long-term economic benefits typically outweigh costs within 10-15 years in metropolitan areas over 500,000 people."

**Output:**
- Strength: 9/10 (strong)
- Has: claim, evidence, warrant, qualifiers, rebuttals
- Suggestions:
  1. Could add backing (explain *why* reduced congestion saves money)
  2. Consider additional sources for stronger backing

## Rate Limiting

**Limit:** 10 requests per minute per user

**When Hit:**
```json
{
  "error": "Too many enhancement requests, please try again later"
}
```

**Response:** HTTP 429

**Solution:** Wait 60 seconds before retrying

## Database Queries

### Check Usage Stats
```sql
SELECT
  COUNT(*) as total_analyses,
  AVG(strength_score) as avg_strength,
  COUNT(CASE WHEN user_feedback = 'helpful' THEN 1 END)::float /
    NULLIF(COUNT(user_feedback), 0) as approval_rate
FROM argument_enhancements
WHERE created_at > NOW() - INTERVAL '7 days';
```

### Top Users
```sql
SELECT
  user_id,
  COUNT(*) as analysis_count,
  AVG(strength_score) as avg_strength
FROM argument_enhancements
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY analysis_count DESC
LIMIT 10;
```

### Popular Suggestions
```sql
SELECT
  suggestion->>'type' as type,
  COUNT(*) as count
FROM argument_enhancements,
  jsonb_array_elements(suggestions) as suggestion
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY type
ORDER BY count DESC;
```

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Response time (p95) | <2s | ~1.8s |
| Success rate | >99% | TBD |
| User approval | >60% | TBD |
| Error rate | <1% | TBD |

## Troubleshooting

### Issue: Analysis not appearing
**Check:**
1. User is logged in
2. Text is >10 characters
3. Debate is enabled for the group
4. No JavaScript console errors

### Issue: Rate limited
**Cause:** More than 10 requests in 1 minute
**Fix:** Wait 60 seconds

### Issue: Slow response
**Check:**
1. OpenRouter API status
2. Network connectivity
3. Server logs for errors
4. Database connection pool

### Issue: Poor suggestions
**Likely:**
- Argument too short (<20 words)
- Text is unclear or fragmented
- Non-standard language

**Fix:** Encourage users to write fuller arguments

## Development

### Run Tests
```bash
# Backend
cd server_api
npm test -- argumentEnhancement

# Frontend
cd webApps/client
npm test -- yp-argument-assistant
```

### Debug Mode
```javascript
// In argumentEnhancementService.cjs
const DEBUG = true;
```

### Mock API for Frontend Development
```javascript
// Mock successful response
fetch.mockResponseOnce(JSON.stringify({
  strengthScore: 7,
  strengthLevel: "moderate",
  components: { /* ... */ },
  suggestions: [ /* ... */ ]
}));
```

## Analytics Dashboard

Track these KPIs:
1. **Daily Active Users** - Users who clicked "Get AI Suggestions"
2. **Analyses Per Day** - Total API calls
3. **Average Strength Score** - Before/after comparison
4. **Approval Rate** - % of "helpful" feedback
5. **Most Common Missing Components** - Guide prompt improvements
6. **Processing Time** - Monitor performance

## Roadmap

- [ ] One-click suggestion templates
- [ ] Multilingual UI translations
- [ ] Fallacy detection integration
- [ ] Argument comparison ("compare to top arguments")
- [ ] Peer review suggestions
- [ ] Gamification (badges for strong arguments)

## Support

- Documentation: `/ARGUMENT_ENHANCEMENT_MODULE.md`
- API Docs: `/api/docs` (if Swagger enabled)
- Issues: GitHub Issues
- Email: support@yourpriorities.org
