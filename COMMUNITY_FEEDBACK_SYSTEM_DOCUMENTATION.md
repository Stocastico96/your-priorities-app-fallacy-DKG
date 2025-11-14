# Community Feedback System for Fallacy Detection Validation

## Overview

This document describes the comprehensive Community Feedback System implemented for validating AI fallacy detections in the Your Priorities platform. The system enables users to provide feedback on AI-detected fallacies, creating a feedback loop for continuous improvement of the fallacy detection system through Reinforcement Learning from Human Feedback (RLHF).

**Implementation Date:** 2025-11-14
**Reference:** Paper Section IV.C "Community Feedback System"

---

## System Architecture

### Components

1. **Database Layer** - PostgreSQL tables for storing fallacy labels and user feedback
2. **API Layer** - RESTful endpoints for CRUD operations and data export
3. **UI Components** - Web widgets for user interaction
4. **Admin Dashboard** - Moderation interface for reviewing controversial detections
5. **Data Export Utility** - Scripts for exporting feedback data for ML retraining

---

## 1. Database Schema

### Tables Created

#### `comment_fallacy_labels`
Stores AI-detected fallacies in points/comments.

**Location:** `/home/user/your-priorities-app-fallacy-DKG/server_api/migrations/fallacyFeedback.cjs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `uuid` | UUID | Unique identifier |
| `point_id` | INTEGER | Foreign key to points table |
| `fallacy_type` | ENUM | Type of fallacy detected (13 types) |
| `confidence_score` | FLOAT | AI confidence (0.0-1.0) |
| `text_excerpt` | TEXT | Text that triggered detection |
| `ai_explanation` | TEXT | AI explanation of why it's a fallacy |
| `ai_suggestion` | TEXT | AI suggestion for improvement |
| `model_version` | STRING | AI model version |
| `status` | ENUM | active/validated/disputed/overridden |
| `moderator_override` | BOOLEAN | Whether moderator has intervened |
| `moderator_user_id` | INTEGER | Foreign key to users |
| `moderator_notes` | TEXT | Moderator notes |
| `created_at` | DATE | Creation timestamp |
| `updated_at` | DATE | Last update timestamp |

**Supported Fallacy Types:**
- Ad Hominem
- Ad Populum (Appeal to Popularity)
- False Causality (Post Hoc)
- Circular Reasoning
- Straw Man
- False Dilemma
- Appeal to Authority
- Slippery Slope
- Hasty Generalization
- Red Herring
- Tu Quoque
- No True Scotsman
- Burden of Proof

**Indexes:**
- `uuid` (unique)
- `point_id`
- `fallacy_type`
- `status`
- `created_at`

#### `fallacy_feedback`
Stores user feedback on fallacy detections.

**Location:** `/home/user/your-priorities-app-fallacy-DKG/server_api/migrations/fallacyFeedback.cjs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `uuid` | UUID | Unique identifier |
| `fallacy_label_id` | INTEGER | Foreign key to comment_fallacy_labels |
| `user_id` | INTEGER | Foreign key to users |
| `feedback_type` | ENUM | correct/false_positive/wrong_type/missed_fallacy |
| `suggested_fallacy_type` | ENUM | User's suggested type (if wrong_type) |
| `explanation` | TEXT | Optional user explanation |
| `confidence` | INTEGER | User confidence (1-10) |
| `helpful_votes` | INTEGER | Number of helpful votes |
| `data` | JSONB | Additional metadata |
| `ip_address` | STRING | User IP address |
| `user_agent` | TEXT | User agent string |
| `created_at` | DATE | Creation timestamp |
| `updated_at` | DATE | Last update timestamp |

**Indexes:**
- `uuid` (unique)
- `fallacy_label_id`
- `user_id`
- `feedback_type`
- `created_at`
- `fallacy_label_id, user_id` (unique composite - prevents duplicate votes)

### Running the Migration

```bash
cd /home/user/your-priorities-app-fallacy-DKG/server_api
npx sequelize-cli db:migrate
```

---

## 2. API Endpoints

**Location:** `/home/user/your-priorities-app-fallacy-DKG/server_api/src/controllers/fallacyFeedback.cjs`

### Create Feedback
```
POST /api/fallacy-feedback
```

**Request Body:**
```json
{
  "fallacyLabelId": 123,
  "feedbackType": "correct | false_positive | wrong_type | missed_fallacy",
  "suggestedFallacyType": "ad_hominem",  // Required if feedbackType = "wrong_type"
  "explanation": "Optional explanation text",
  "confidence": 7  // 1-10 scale
}
```

**Response:**
```json
{
  "success": true,
  "feedback": {
    "id": 456,
    "fallacy_label_id": 123,
    "user_id": 789,
    "feedback_type": "correct",
    "created_at": "2025-11-14T10:00:00Z"
  }
}
```

**Validation:**
- User must be logged in
- User cannot vote multiple times on same fallacy
- `suggestedFallacyType` required when `feedbackType = "wrong_type"`

### Get Feedback Statistics
```
GET /api/fallacy-feedback/stats/:fallacyLabelId
```

**Response:**
```json
{
  "success": true,
  "fallacyLabelId": 123,
  "stats": {
    "total": 10,
    "correct": 8,
    "false_positive": 1,
    "wrong_type": 1,
    "missed_fallacy": 0,
    "positive_percentage": 80,
    "negative_percentage": 20,
    "is_controversial": false
  }
}
```

### Get Controversial Fallacies
```
GET /api/fallacy-feedback/controversial?limit=50&offset=0&minFeedbacks=3
```

**Parameters:**
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset
- `minFeedbacks` - Minimum feedback count required (default: 3)

**Response:**
```json
{
  "success": true,
  "total": 15,
  "limit": 50,
  "offset": 0,
  "controversialFallacies": [
    {
      "fallacyLabel": {
        "id": 123,
        "fallacy_type": "ad_hominem",
        "confidence_score": 0.85,
        "ai_explanation": "This appears to attack the person..."
      },
      "point": {
        "id": 456,
        "content": "The comment text..."
      },
      "feedbackStats": {
        "total": 10,
        "correct": 4,
        "false_positive": 5,
        "wrong_type": 1,
        "dispute_rate": 60
      }
    }
  ]
}
```

### Get Fallacies for a Point
```
GET /api/fallacy-feedback/point/:pointId
```

Returns all fallacy labels and their feedback for a specific point.

### Update Feedback
```
PUT /api/fallacy-feedback/:id
```

Users can update their own feedback. Same request body as create.

### Delete Feedback
```
DELETE /api/fallacy-feedback/:id
```

Soft delete. Users can only delete their own feedback (or moderators can delete any).

### Moderator Override
```
POST /api/fallacy-feedback/:fallacyLabelId/override
```

**Request Body:**
```json
{
  "status": "overridden | validated | disputed",
  "notes": "Moderator notes explaining the override"
}
```

**Authorization:** Requires moderator access

### Export Feedback Data
```
GET /api/fallacy-feedback/export?format=csv|json|ml
```

**Formats:**
- `csv` - CSV format for spreadsheet analysis
- `json` - JSON format for data analysis
- `ml` - JSONL format optimized for ML training

**Response:** File download

**Authorization:** Requires moderator access

### Get Statistics
```
GET /api/fallacy-feedback/statistics
```

Returns overall system statistics including fallacy distribution, consensus rates, etc.

**Authorization:** Requires moderator access

---

## 3. Sequelize Models

### CommentFallacyLabel Model
**Location:** `/home/user/your-priorities-app-fallacy-DKG/server_api/src/models/commentFallacyLabel.cjs`

**Relationships:**
- `belongsTo(Point)` - The point/comment that was flagged
- `belongsTo(User as Moderator)` - The moderator who overrode (if any)
- `hasMany(FallacyFeedback)` - All feedback on this detection

**Methods:**
- `getFallacyDisplayName()` - Returns human-readable fallacy name
- `getAllFallacyTypes()` - Static method returning all fallacy types

### FallacyFeedback Model
**Location:** `/home/user/your-priorities-app-fallacy-DKG/server_api/src/models/fallacyFeedback.cjs`

**Relationships:**
- `belongsTo(CommentFallacyLabel as FallacyLabel)` - The fallacy detection being validated
- `belongsTo(User)` - The user who provided feedback

**Methods:**
- `isPositiveFeedback()` - Returns true if feedback confirms detection
- `isNegativeFeedback()` - Returns true if feedback disputes detection
- `getAggregatedStats(fallacyLabelId)` - Static method to aggregate all feedback for a fallacy

---

## 4. UI Components

### Fallacy Feedback Widget
**Location:** `/home/user/your-priorities-app-fallacy-DKG/webApps/client/src/yp-post/yp-fallacy-feedback-widget.ts`

**Component:** `<yp-fallacy-feedback-widget>`

**Properties:**
- `fallacyLabel` - The fallacy label object
- `point` - The point/comment object

**Features:**
- Displays fallacy type and AI confidence
- Shows AI explanation and improvement suggestion
- Feedback buttons: "Yes, Correct", "False Positive", "Wrong Type"
- Expandable form for detailed feedback
- Real-time aggregated statistics display
- Visual feedback (success/error messages)

**Usage Example:**
```html
<yp-fallacy-feedback-widget
  .fallacyLabel="${fallacyLabel}"
  .point="${point}">
</yp-fallacy-feedback-widget>
```

**Visual Design:**
- Subtle, non-intrusive layout
- Color-coded badges for status (active, validated, disputed)
- Progress bar showing community consensus
- Material Design 3 components

**User Flow:**
1. User sees detected fallacy with explanation
2. Clicks feedback button (e.g., "Yes, Correct")
3. If "Wrong Type" selected, dropdown appears with all fallacy types
4. Optional explanation textarea
5. Submit button sends feedback
6. Success message and updated statistics display

---

## 5. Admin Dashboard

### Fallacy Moderation Dashboard
**Location:** `/home/user/your-priorities-app-fallacy-DKG/webApps/client/src/admin/yp-admin-fallacy-moderation.ts`

**Component:** `<yp-admin-fallacy-moderation>`

**Features:**

#### Overview Statistics
- Total controversial detections
- Average dispute rate
- Current page summary

#### Controversy Detection
Automatically identifies fallacies with:
- More than 30% negative feedback
- Minimum feedback threshold (configurable: 1, 3, 5, 10+)
- Sorted by dispute rate (highest first)

#### Fallacy Item Display
Each controversial detection shows:
- Fallacy type and confidence score
- Dispute rate badge
- Full comment text
- Breakdown of feedback (correct/false positive/wrong type)
- AI explanation
- Action buttons

#### Moderator Actions
- **Override Decision** - Change status to overridden/validated/disputed
- **Add Notes** - Document reasoning for override
- **View Details** - See full feedback history

#### Data Export
- Export to CSV for spreadsheet analysis
- Export to JSON for programmatic analysis
- Export to JSONL for ML training
- One-click download with timestamp

#### Pagination
- Configurable results per page
- Page navigation controls
- Total count display

**Access Control:** Requires moderator permissions

---

## 6. Data Export Utility

### Export Script
**Location:** `/home/user/your-priorities-app-fallacy-DKG/server_api/src/utils/exportFallacyFeedback.cjs`

**Class:** `FallacyFeedbackExporter`

### Export Formats

#### 1. CSV Export
```bash
node exportFallacyFeedback.cjs csv output/feedback.csv
```

**Columns:**
- fallacy_label_id, point_id, comment_text
- detected_fallacy, ai_confidence
- ai_explanation, ai_suggestion
- model_version, status, moderator_override
- total_feedbacks, correct_votes, false_positive_votes, wrong_type_votes
- consensus, consensus_score, positive_rate, negative_rate
- created_at

**Use Case:** Data analysis in Excel/Google Sheets

#### 2. JSON Export
```bash
node exportFallacyFeedback.cjs json output/feedback.json
```

**Structure:**
```json
[
  {
    "fallacy_label_id": 123,
    "point_id": 456,
    "comment_text": "...",
    "detected_fallacy": "ad_hominem",
    "ai_confidence": 0.85,
    "feedback": {
      "total": 10,
      "consensus": "confirmed",
      "consensus_score": 0.8
    }
  }
]
```

**Use Case:** Programmatic analysis, data visualization

#### 3. ML Training Export (JSONL)
```bash
node exportFallacyFeedback.cjs ml output/training-data.jsonl
```

**Format:** One JSON object per line
```json
{"text":"...","detected_fallacy":"ad_hominem","ai_confidence":0.85,"community_consensus":"confirmed","consensus_score":0.8,"is_true_positive":true,"is_false_positive":false,"feedback_count":10}
{"text":"...","detected_fallacy":"straw_man","ai_confidence":0.72,"community_consensus":"rejected","consensus_score":0.7,"is_true_positive":false,"is_false_positive":true,"feedback_count":8}
```

**Features:**
- Filters by minimum feedback count (default: 3)
- Excludes uncertain consensus (optional)
- Includes/excludes moderator-overridden (configurable)
- Ready for fine-tuning language models

**Use Case:** RLHF model retraining

#### 4. Detailed Feedback Export
```bash
node exportFallacyFeedback.cjs detailed output/detailed-feedback.json
```

**Structure:** Individual feedback responses with user IDs

#### 5. Statistics
```bash
node exportFallacyFeedback.cjs stats
```

**Output:**
```json
{
  "total_fallacy_labels": 1234,
  "by_type": {
    "ad_hominem": 250,
    "straw_man": 180,
    "false_causality": 150
  },
  "by_consensus": {
    "confirmed": 800,
    "rejected": 200,
    "uncertain": 234
  },
  "feedback_stats": {
    "total_feedbacks": 5678,
    "avg_feedbacks_per_label": 4.6,
    "moderator_overrides": 45
  }
}
```

### Consensus Calculation

The system calculates consensus based on feedback distribution:

| Consensus | Condition |
|-----------|-----------|
| `confirmed` | ≥70% positive feedback |
| `rejected` | ≥70% negative feedback |
| `likely_correct` | ≥50% positive, 5+ feedbacks |
| `likely_incorrect` | ≥50% negative, 5+ feedbacks |
| `uncertain` | Otherwise |

**Consensus Score:** Percentage of agreement (0.0-1.0)

---

## 7. RLHF Foundation

### Data Format for Model Retraining

The ML export provides data in a format suitable for:
- Fine-tuning transformer models (BERT, RoBERTa, GPT)
- Reinforcement Learning from Human Feedback (RLHF)
- Active learning pipelines
- Model evaluation and testing

### Training Data Structure

Each training example includes:
- **Input:** The original comment text
- **Prediction:** AI-detected fallacy type
- **Label:** Community consensus (ground truth)
- **Confidence:** Both AI confidence and consensus score
- **Metadata:** Model version, feedback count, timestamps

### Recommended Training Pipeline

1. **Export Training Data**
   ```bash
   curl "http://localhost:8080/api/fallacy-feedback/export?format=ml" > training-data.jsonl
   ```

2. **Filter High-Quality Examples**
   - Minimum 5 feedbacks per example
   - Consensus score ≥ 0.7
   - Exclude moderator overrides (unless specifically training on edge cases)

3. **Split Dataset**
   - Training: 70% (confirmed and rejected)
   - Validation: 15%
   - Test: 15%

4. **Training Objectives**
   - **Binary Classification:** Is this a fallacy? (true_positive/false_positive)
   - **Multi-class Classification:** Which fallacy type?
   - **Confidence Calibration:** Align AI confidence with community consensus

5. **Evaluation Metrics**
   - Precision, Recall, F1-score per fallacy type
   - Calibration error (AI confidence vs. actual accuracy)
   - Agreement with community consensus

6. **Active Learning**
   - Prioritize uncertain cases (consensus_score < 0.5) for additional feedback
   - Use controversy detection to identify edge cases

---

## 8. Integration with Existing System

### Points Integration

To display fallacy feedback widgets on points/comments, integrate in the point display component:

**File:** `/home/user/your-priorities-app-fallacy-DKG/webApps/client/src/yp-point/yp-point.ts`

```typescript
import '../yp-post/yp-fallacy-feedback-widget.js';

// In render method, after point content:
${this.point.fallacy_labels?.map(label => html`
  <yp-fallacy-feedback-widget
    .fallacyLabel="${label}"
    .point="${this.point}">
  </yp-fallacy-feedback-widget>
`)}
```

### Router Integration

Add the fallacy feedback controller to the main router:

**File:** `/home/user/your-priorities-app-fallacy-DKG/server_api/src/controllers/index.cjs`

```javascript
var fallacyFeedback = require('./fallacyFeedback.cjs');
// ...
app.use('/api/fallacy-feedback', fallacyFeedback);
```

### Admin Menu Integration

Add link to admin dashboard:

**File:** `/home/user/your-priorities-app-fallacy-DKG/webApps/client/src/admin/yp-admin-app.ts`

```typescript
{
  name: 'Fallacy Moderation',
  route: '/admin/fallacy-moderation',
  icon: 'gavel'
}
```

---

## 9. Sample Data Export Format

### CSV Sample
```csv
fallacy_label_id,point_id,comment_text,detected_fallacy,ai_confidence,total_feedbacks,consensus,consensus_score
123,456,"This is a terrible argument from someone who doesn't understand the topic",ad_hominem,0.87,12,confirmed,0.83
124,457,"Everyone knows this is the right approach",ad_populum,0.75,8,rejected,0.75
125,458,"After implementing policy X, crime increased",false_causality,0.68,5,uncertain,0.60
```

### JSONL Sample (ML Training)
```jsonl
{"text":"This is a terrible argument from someone who doesn't understand the topic","detected_fallacy":"ad_hominem","ai_confidence":0.87,"community_consensus":"confirmed","consensus_score":0.83,"is_true_positive":true,"is_false_positive":false,"feedback_count":12,"metadata":{"fallacy_label_id":123,"point_id":456,"model_version":"v1.0","created_at":"2025-11-14T10:00:00Z"}}
{"text":"Everyone knows this is the right approach","detected_fallacy":"ad_populum","ai_confidence":0.75,"community_consensus":"rejected","consensus_score":0.75,"is_true_positive":false,"is_false_positive":true,"feedback_count":8,"metadata":{"fallacy_label_id":124,"point_id":457,"model_version":"v1.0","created_at":"2025-11-14T11:00:00Z"}}
```

---

## 10. Acceptance Criteria Checklist

- [x] **Users can easily provide feedback**
  - Simple button interface: "Yes, Correct", "False Positive", "Wrong Type"
  - Optional detailed explanation
  - Prevents duplicate voting
  - Visual confirmation of submission

- [x] **Feedback stored correctly in database**
  - Two-table schema (labels + feedback)
  - Proper foreign keys and relationships
  - Indexes for performance
  - Unique constraint preventing duplicate votes

- [x] **Aggregated stats visible to all users**
  - Real-time statistics on each fallacy widget
  - Shows total feedbacks, positive/negative percentages
  - Visual progress bar
  - "X/Y users found this helpful" display

- [x] **Moderators can review disputed cases**
  - Dedicated admin dashboard
  - Automatic controversy detection (>30% dispute rate)
  - Filtering by minimum feedback count
  - Pagination for large datasets

- [x] **Data exportable for future ML retraining**
  - CSV export for analysis
  - JSON export for programmatic use
  - JSONL export optimized for ML training
  - CLI utility for batch exports
  - API endpoints for programmatic access

---

## 11. Security Considerations

### Authentication & Authorization
- All feedback endpoints require user login
- Export and moderation endpoints require moderator role
- Users can only update/delete their own feedback
- Unique constraint prevents vote manipulation

### Data Privacy
- IP addresses and user agents stored for audit trail
- Personal data exportable per GDPR requirements
- Moderator notes kept private (not exposed to regular users)

### Input Validation
- Feedback type validated against enum
- Fallacy type validated against allowed values
- SQL injection prevention via Sequelize ORM
- XSS prevention via proper escaping

---

## 12. Performance Considerations

### Database Indexes
- All foreign keys indexed
- Composite index on (fallacy_label_id, user_id) for duplicate prevention
- Created_at indexed for temporal queries
- Status and feedback_type indexed for filtering

### Caching Opportunities
- Aggregate statistics (cache for 5 minutes)
- Controversial fallacies list (cache for 10 minutes)
- Export generation (queue for large datasets)

### Query Optimization
- Use joins to fetch related data in single query
- Pagination for large result sets
- Limit included associations to necessary fields

---

## 13. Future Enhancements

### Short-term (1-2 months)
- [ ] Email notifications for controversial detections
- [ ] User reputation system for feedback quality
- [ ] Batch feedback import from external sources
- [ ] Real-time WebSocket updates for live stats

### Medium-term (3-6 months)
- [ ] A/B testing different AI explanations
- [ ] Gamification (badges for helpful feedback)
- [ ] Integration with DelibAI agent system
- [ ] Automated retraining pipeline

### Long-term (6-12 months)
- [ ] Federated learning across multiple deployments
- [ ] Multi-language fallacy detection
- [ ] Integration with external argument databases
- [ ] Blockchain-based immutable feedback trail

---

## 14. Testing Recommendations

### Unit Tests
```javascript
// Test feedback creation
describe('FallacyFeedback', () => {
  it('should prevent duplicate votes', async () => {
    // Create first feedback
    await FallacyFeedback.create({...});
    // Attempt duplicate
    await expect(FallacyFeedback.create({...})).to.be.rejected;
  });
});
```

### Integration Tests
- Test full feedback submission flow
- Test consensus calculation
- Test export generation
- Test moderator override

### UI Tests
- Test feedback widget interactions
- Test admin dashboard filtering
- Test export button functionality

---

## 15. Deployment Checklist

- [ ] Run database migration
- [ ] Add fallacy feedback controller to router
- [ ] Register UI components
- [ ] Configure moderator permissions
- [ ] Set up export directory with write permissions
- [ ] Test all API endpoints
- [ ] Verify UI components render correctly
- [ ] Test export functionality
- [ ] Configure backup for fallacy feedback tables
- [ ] Set up monitoring for feedback submission errors

---

## 16. Monitoring & Analytics

### Key Metrics to Track
- Feedback submission rate
- Average feedbacks per fallacy
- Consensus distribution (confirmed/rejected/uncertain)
- Moderator override frequency
- Export download frequency
- API response times

### Logging
All operations logged with:
- User ID
- Action type
- Timestamp
- Success/failure status
- Error details (if applicable)

### Alerts
- High dispute rate (>50% for multiple fallacies)
- Sudden drop in feedback submissions
- Export failures
- Database query timeouts

---

## Conclusion

This Community Feedback System provides a complete solution for validating AI fallacy detections through community input. It creates a virtuous cycle where:

1. AI detects potential fallacies
2. Users validate or contest detections
3. Community consensus emerges
4. Moderators review controversial cases
5. Feedback data exported for model retraining
6. AI improves based on real-world feedback

The system is designed to be scalable, maintainable, and extensible, providing a strong foundation for continuous improvement of fallacy detection through RLHF.

---

## Contact & Support

For questions or issues:
- Review this documentation
- Check server logs: `/var/log/your-priorities/`
- Review database migration status
- Test API endpoints with provided examples

**Last Updated:** 2025-11-14
