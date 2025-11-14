# PSV Quick Start Guide

Get up and running with Perspectivized Stance Vectors in 5 minutes.

## Step 1: Setup Database (1 minute)

```bash
cd server_api

# Run the PSV migration
npx sequelize-cli db:migrate

# Or if using npm scripts
npm run migrate
```

This creates the `deliberation_dimensions` and `comment_stance_vectors` tables.

## Step 2: Configure LLM API (30 seconds)

Choose one option:

**Option A: OpenAI (recommended for accuracy)**
```bash
export OPENAI_API_KEY=sk-your-key-here
```

**Option B: OpenRouter (recommended for cost)**
```bash
export OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Add to your `.env` file to persist:
```bash
echo "OPENAI_API_KEY=sk-your-key" >> .env
```

## Step 3: Test the Implementation (2 minutes)

```bash
cd server_api/src/services/analysis

# Run the test suite
node psvExampleTest.cjs
```

Expected output:
```
PSV IMPLEMENTATION TEST RESULTS
================================

SETUP:
  groupId: 1
  postId: 123
  pointIds: [456, 457, 458, 459, 460]
  dimensionsCount: 5

PERFORMANCE METRICS:
  calculation:
    totalPoints: 5
    successfulCalculations: 5
    averageTimeMs: 7843
    minTimeMs: 6234
    maxTimeMs: 9821

SAMPLE PSV CALCULATION (First Comment):
  Comment: We need immediate action on climate change...
  Processing Time: 8234ms

  Stance Vector:
    economic_impact: 0.682 (confidence: 0.850)
    environmental_urgency: 0.923 (confidence: 0.950)
    technological_feasibility: 0.567 (confidence: 0.780)
    ...
```

## Step 4: Create Dimensions for Your Posts

### Via API

```bash
# Create dimensions for a post using climate policy template
curl -X POST http://localhost:4242/api/posts/YOUR_POST_ID/dimensions \
  -H "Content-Type: application/json" \
  -d '{"template": "climate_policy"}'

# Or use general template
curl -X POST http://localhost:4242/api/posts/YOUR_POST_ID/dimensions \
  -H "Content-Type: application/json" \
  -d '{"template": "general"}'
```

### Via Code

```javascript
const perspectiveDimensions = require('./server_api/src/services/analysis/perspectiveDimensions.cjs');

// Create dimensions for post
await perspectiveDimensions.createFromTemplate('climate_policy', postId);
```

### Available Templates
- `climate_policy` - 5 dimensions for environmental policy
- `public_health` - 4 dimensions for health policy
- `urban_development` - 4 dimensions for city planning
- `general` - 4 dimensions for any topic

## Step 5: Post Comments and Watch PSV Calculate

Once dimensions exist, PSV calculation happens **automatically** when users post comments:

1. User posts comment → saved to database
2. PSV job queued automatically
3. Background worker processes in 5-10 seconds
4. Results available via API

No manual intervention needed!

## Step 6: View Results

### Get Comment Stance Vector

```bash
curl http://localhost:4242/api/points/COMMENT_ID/stance-vector
```

Response:
```json
{
  "pointId": 456,
  "vector": [
    {
      "dimension": "economic_impact",
      "stanceValue": 0.682,
      "confidence": 0.850,
      "explanation": "Comment emphasizes economic opportunity from green jobs"
    },
    ...
  ]
}
```

### Get Post Aggregate Analysis

```bash
curl http://localhost:4242/api/posts/POST_ID/stance-analysis
```

Response shows community averages, polarization, and consensus dimensions.

### Compare Two Comments

```bash
curl -X POST http://localhost:4242/api/analysis/compare-stances \
  -H "Content-Type: application/json" \
  -d '{"pointId1": 456, "pointId2": 457}'
```

Response shows similarity score, agreement level, and common ground.

## Step 7: Add Visualization to Frontend

```html
<!-- In your post detail template -->
<yp-stance-radar
  .postId="${post.id}">
</yp-stance-radar>

<!-- Or for individual comment -->
<yp-stance-radar
  .pointId="${comment.id}">
</yp-stance-radar>
```

## Verify It's Working

### Check Worker Logs
```bash
# Look for PSV calculation logs
tail -f logs/worker.log | grep psv

# Should see:
# "PSV calculation job started"
# "Successfully calculated PSV"
# "PSV calculation job completed"
```

### Check Database
```sql
-- See calculated stance vectors
SELECT
  p.content,
  dd.dimension_name,
  csv.stance_value,
  csv.confidence
FROM comment_stance_vectors csv
JOIN points p ON p.id = csv.point_id
JOIN deliberation_dimensions dd ON dd.id = csv.dimension_id
ORDER BY p.id, dd.position;
```

## Common Commands

```bash
# Get available templates
curl http://localhost:4242/api/analysis/dimension-templates

# Get dimensions for a post
curl http://localhost:4242/api/posts/POST_ID/dimensions

# Manually trigger PSV calculation (if needed)
curl -X POST http://localhost:4242/api/points/COMMENT_ID/calculate-psv

# Find similar stances
curl http://localhost:4242/api/points/COMMENT_ID/similar-stances?threshold=0.7
```

## Troubleshooting

### "No dimensions found for this deliberation"
**Solution**: Create dimensions first using Step 4 above.

### "PSV not calculating"
**Solution**:
1. Check API key is set: `echo $OPENAI_API_KEY`
2. Check worker is running: `ps aux | grep worker`
3. Check logs: `tail -f logs/worker.log`

### "Error: rate limit exceeded"
**Solution**:
- Wait a minute and retry
- Upgrade OpenAI plan
- Or switch to OpenRouter (higher limits)

### "Calculation too slow"
**Solution**:
- Add more worker instances (edit `main.cjs`, increase concurrency)
- Use faster model (GPT-4o-mini is already fast)
- Process in batches during off-peak hours

## Production Deployment

### Environment Variables
```bash
# Required
OPENAI_API_KEY=sk-...
# or
OPENROUTER_API_KEY=sk-or-v1-...

# Already configured
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://...
```

### Worker Configuration

In `server_api/src/services/workers/main.cjs`:
```javascript
// Adjust concurrency based on load
queue.process('process-psv-calculation', 5, function(job, done) {
  psvCalculation.process(job.data, done);
});
```

### Monitoring

```bash
# Watch queue stats
redis-cli INFO | grep queue

# Monitor worker health
pm2 status
pm2 logs worker

# Database growth
SELECT COUNT(*) FROM comment_stance_vectors;
```

## Performance Benchmarks

- **Single PSV calculation**: 5-10 seconds (5 dimensions)
- **Throughput**: 100-300 comments/hour (2 workers)
- **Comparison**: <100ms
- **Aggregate analysis**: 200-500ms

Scale horizontally by adding worker instances.

## Cost Estimates

**OpenAI GPT-4o-mini**:
- $0.00015 per 1K input tokens
- $0.0006 per 1K output tokens
- ~$0.003-0.005 per comment (5 dimensions)
- 1000 comments ≈ $3-5

**OpenRouter DeepSeek**:
- ~10x cheaper than OpenAI
- 1000 comments ≈ $0.30-0.50

## Next Steps

1. ✅ Create dimensions for your active deliberations
2. ✅ Let users post comments (PSV calculates automatically)
3. ✅ Add visualization to post pages
4. ✅ Monitor performance and adjust workers
5. 📊 Analyze results and identify common ground!

## Support

- Full docs: `server_api/src/services/analysis/README.md`
- Test suite: `server_api/src/services/analysis/psvExampleTest.cjs`
- Summary: `PSV_IMPLEMENTATION_SUMMARY.md`

---

**Ready to go!** Your PSV system is now operational. Post some comments and watch the consensus analysis in action.
