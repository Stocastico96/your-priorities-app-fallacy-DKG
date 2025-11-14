import { html, css, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { YpBaseElementWithLogin } from "../common/yp-base-element-with-login.js";

import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/iconbutton/icon-button.js";
import "@material/web/progress/circular-progress.js";

/**
 * YpFallacyFeedbackWidget
 *
 * Displays under each detected fallacy to allow users to provide feedback
 * on the accuracy of AI fallacy detection.
 */
@customElement("yp-fallacy-feedback-widget")
export class YpFallacyFeedbackWidget extends YpBaseElementWithLogin {
  @property({ type: Object })
  fallacyLabel!: YpFallacyLabel;

  @property({ type: Object })
  point!: YpPointData;

  @state()
  feedbackStats: YpFallacyFeedbackStats | null = null;

  @state()
  userFeedback: YpFallacyFeedback | null = null;

  @state()
  showFeedbackForm = false;

  @state()
  selectedFeedbackType: 'correct' | 'false_positive' | 'wrong_type' | 'missed_fallacy' | null = null;

  @state()
  selectedFallacyType: string | null = null;

  @state()
  explanation = "";

  @state()
  isSubmitting = false;

  @state()
  errorMessage = "";

  @state()
  successMessage = "";

  static override styles = [
    super.styles,
    css`
      :host {
        display: block;
        margin-top: 8px;
        padding: 12px;
        background: var(--md-sys-color-surface-variant);
        border-radius: 8px;
        font-size: 14px;
      }

      .fallacy-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .fallacy-type {
        font-weight: 600;
        color: var(--md-sys-color-error);
        font-size: 14px;
      }

      .confidence-badge {
        padding: 2px 8px;
        border-radius: 12px;
        background: var(--md-sys-color-tertiary-container);
        color: var(--md-sys-color-on-tertiary-container);
        font-size: 12px;
      }

      .status-badge {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
      }

      .status-active {
        background: var(--md-sys-color-primary-container);
        color: var(--md-sys-color-on-primary-container);
      }

      .status-validated {
        background: var(--md-sys-color-tertiary-container);
        color: var(--md-sys-color-on-tertiary-container);
      }

      .status-disputed {
        background: var(--md-sys-color-error-container);
        color: var(--md-sys-color-on-error-container);
      }

      .ai-explanation {
        margin: 8px 0;
        padding: 8px;
        background: var(--md-sys-color-surface);
        border-radius: 4px;
        font-style: italic;
        color: var(--md-sys-color-on-surface-variant);
      }

      .ai-suggestion {
        margin: 8px 0;
        padding: 8px;
        background: var(--md-sys-color-tertiary-container);
        border-radius: 4px;
        color: var(--md-sys-color-on-tertiary-container);
      }

      .feedback-question {
        margin: 12px 0 8px 0;
        font-weight: 500;
        color: var(--md-sys-color-on-surface);
      }

      .feedback-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }

      .feedback-button {
        --md-outlined-button-container-height: 32px;
        font-size: 13px;
      }

      .feedback-button.selected {
        --md-outlined-button-outline-color: var(--md-sys-color-primary);
        --md-outlined-button-label-text-color: var(--md-sys-color-primary);
        background: var(--md-sys-color-primary-container);
      }

      .feedback-form {
        margin-top: 12px;
        padding: 12px;
        background: var(--md-sys-color-surface);
        border-radius: 8px;
      }

      .form-field {
        margin-bottom: 12px;
      }

      .form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .stats-container {
        margin-top: 8px;
        padding: 8px;
        background: var(--md-sys-color-surface);
        border-radius: 4px;
        font-size: 13px;
      }

      .stats-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
      }

      .stats-bar {
        height: 4px;
        background: var(--md-sys-color-outline);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 4px;
      }

      .stats-bar-fill {
        height: 100%;
        background: var(--md-sys-color-tertiary);
        transition: width 0.3s ease;
      }

      .error-message {
        color: var(--md-sys-color-error);
        padding: 8px;
        margin-top: 8px;
        background: var(--md-sys-color-error-container);
        border-radius: 4px;
      }

      .success-message {
        color: var(--md-sys-color-tertiary);
        padding: 8px;
        margin-top: 8px;
        background: var(--md-sys-color-tertiary-container);
        border-radius: 4px;
      }

      .loading {
        display: flex;
        justify-content: center;
        padding: 16px;
      }

      md-outlined-text-field {
        width: 100%;
      }

      md-outlined-select {
        width: 100%;
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    this.loadFeedbackStats();
  }

  async loadFeedbackStats() {
    try {
      const response = await fetch(
        `/api/fallacy-feedback/stats/${this.fallacyLabel.id}`
      );
      const data = await response.json();
      if (data.success) {
        this.feedbackStats = data.stats;
      }
    } catch (error) {
      console.error("Error loading feedback stats:", error);
    }
  }

  getFallacyDisplayName(type: string): string {
    const names: Record<string, string> = {
      ad_hominem: "Ad Hominem",
      ad_populum: "Ad Populum (Appeal to Popularity)",
      false_causality: "False Causality (Post Hoc)",
      circular_reasoning: "Circular Reasoning",
      straw_man: "Straw Man",
      false_dilemma: "False Dilemma",
      appeal_to_authority: "Appeal to Authority",
      slippery_slope: "Slippery Slope",
      hasty_generalization: "Hasty Generalization",
      red_herring: "Red Herring",
      tu_quoque: "Tu Quoque",
      no_true_scotsman: "No True Scotsman",
      burden_of_proof: "Burden of Proof",
    };
    return names[type] || type;
  }

  getStatusClass(status: string): string {
    return `status-badge status-${status}`;
  }

  handleFeedbackButtonClick(feedbackType: 'correct' | 'false_positive' | 'wrong_type' | 'missed_fallacy') {
    if (!this.isLoggedIn) {
      this.fire("yp-open-login");
      return;
    }

    this.selectedFeedbackType = feedbackType;
    this.showFeedbackForm = feedbackType !== 'correct';

    if (feedbackType === 'correct') {
      this.submitFeedback();
    }
  }

  async submitFeedback() {
    if (!this.isLoggedIn) {
      this.fire("yp-open-login");
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = "";
    this.successMessage = "";

    try {
      const body: any = {
        fallacyLabelId: this.fallacyLabel.id,
        feedbackType: this.selectedFeedbackType,
        explanation: this.explanation || null,
        confidence: 5,
      };

      if (this.selectedFeedbackType === 'wrong_type' && this.selectedFallacyType) {
        body.suggestedFallacyType = this.selectedFallacyType;
      }

      const response = await fetch('/api/fallacy-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.successMessage = "Thank you for your feedback!";
        this.userFeedback = data.feedback;
        this.showFeedbackForm = false;
        this.loadFeedbackStats(); // Reload stats

        // Fire event to notify parent
        this.fire("fallacy-feedback-submitted", {
          fallacyLabelId: this.fallacyLabel.id,
          feedback: data.feedback
        });
      } else {
        this.errorMessage = data.error || "Failed to submit feedback";
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      this.errorMessage = "An error occurred. Please try again.";
    } finally {
      this.isSubmitting = false;
    }
  }

  cancelFeedback() {
    this.showFeedbackForm = false;
    this.selectedFeedbackType = null;
    this.selectedFallacyType = null;
    this.explanation = "";
    this.errorMessage = "";
  }

  renderFallacyHeader() {
    return html`
      <div class="fallacy-header">
        <span class="fallacy-type">
          ${this.getFallacyDisplayName(this.fallacyLabel.fallacy_type)}
        </span>
        <span class="confidence-badge">
          ${Math.round((this.fallacyLabel.confidence_score || 0) * 100)}% confident
        </span>
        <span class="${this.getStatusClass(this.fallacyLabel.status || 'active')}">
          ${this.fallacyLabel.status || 'active'}
        </span>
      </div>
    `;
  }

  renderAiExplanation() {
    if (!this.fallacyLabel.ai_explanation) return html``;

    return html`
      <div class="ai-explanation">
        <strong>Why this might be a fallacy:</strong><br />
        ${this.fallacyLabel.ai_explanation}
      </div>
    `;
  }

  renderAiSuggestion() {
    if (!this.fallacyLabel.ai_suggestion) return html``;

    return html`
      <div class="ai-suggestion">
        <strong>Suggestion:</strong><br />
        ${this.fallacyLabel.ai_suggestion}
      </div>
    `;
  }

  renderFeedbackButtons() {
    if (this.userFeedback) {
      return html`
        <div class="success-message">
          You marked this as: <strong>${this.userFeedback.feedback_type.replace('_', ' ')}</strong>
        </div>
      `;
    }

    return html`
      <div class="feedback-question">Was this detection accurate?</div>
      <div class="feedback-buttons">
        <md-outlined-button
          class="feedback-button ${this.selectedFeedbackType === 'correct' ? 'selected' : ''}"
          @click="${() => this.handleFeedbackButtonClick('correct')}"
          ?disabled="${this.isSubmitting}"
        >
          ✓ Yes, Correct
        </md-outlined-button>
        <md-outlined-button
          class="feedback-button ${this.selectedFeedbackType === 'false_positive' ? 'selected' : ''}"
          @click="${() => this.handleFeedbackButtonClick('false_positive')}"
          ?disabled="${this.isSubmitting}"
        >
          ✗ False Positive
        </md-outlined-button>
        <md-outlined-button
          class="feedback-button ${this.selectedFeedbackType === 'wrong_type' ? 'selected' : ''}"
          @click="${() => this.handleFeedbackButtonClick('wrong_type')}"
          ?disabled="${this.isSubmitting}"
        >
          ⚠ Wrong Type
        </md-outlined-button>
      </div>
    `;
  }

  renderFeedbackForm() {
    if (!this.showFeedbackForm) return html``;

    const fallacyTypes = [
      { value: 'ad_hominem', label: 'Ad Hominem' },
      { value: 'ad_populum', label: 'Ad Populum' },
      { value: 'false_causality', label: 'False Causality' },
      { value: 'circular_reasoning', label: 'Circular Reasoning' },
      { value: 'straw_man', label: 'Straw Man' },
      { value: 'false_dilemma', label: 'False Dilemma' },
      { value: 'appeal_to_authority', label: 'Appeal to Authority' },
      { value: 'slippery_slope', label: 'Slippery Slope' },
      { value: 'hasty_generalization', label: 'Hasty Generalization' },
      { value: 'red_herring', label: 'Red Herring' },
      { value: 'tu_quoque', label: 'Tu Quoque' },
      { value: 'no_true_scotsman', label: 'No True Scotsman' },
      { value: 'burden_of_proof', label: 'Burden of Proof' },
    ];

    return html`
      <div class="feedback-form">
        ${this.selectedFeedbackType === 'wrong_type' ? html`
          <div class="form-field">
            <md-outlined-select
              label="What type of fallacy is this?"
              @change="${(e: any) => this.selectedFallacyType = e.target.value}"
            >
              ${fallacyTypes.map(type => html`
                <md-select-option value="${type.value}">
                  ${type.label}
                </md-select-option>
              `)}
            </md-outlined-select>
          </div>
        ` : ''}

        <div class="form-field">
          <md-outlined-text-field
            type="textarea"
            label="Explanation (optional)"
            rows="3"
            .value="${this.explanation}"
            @input="${(e: any) => this.explanation = e.target.value}"
          ></md-outlined-text-field>
        </div>

        <div class="form-actions">
          <md-text-button @click="${this.cancelFeedback}" ?disabled="${this.isSubmitting}">
            Cancel
          </md-text-button>
          <md-filled-button @click="${this.submitFeedback}" ?disabled="${this.isSubmitting}">
            ${this.isSubmitting ? html`<md-circular-progress indeterminate></md-circular-progress>` : 'Submit'}
          </md-filled-button>
        </div>
      </div>
    `;
  }

  renderStats() {
    if (!this.feedbackStats || this.feedbackStats.total === 0) {
      return html``;
    }

    return html`
      <div class="stats-container">
        <div class="stats-row">
          <span>${this.feedbackStats.total} user${this.feedbackStats.total === 1 ? '' : 's'} provided feedback</span>
          <span>${Math.round(this.feedbackStats.positive_percentage)}% found this helpful</span>
        </div>
        <div class="stats-bar">
          <div class="stats-bar-fill" style="width: ${this.feedbackStats.positive_percentage}%"></div>
        </div>
      </div>
    `;
  }

  override render() {
    return html`
      ${this.renderFallacyHeader()}
      ${this.renderAiExplanation()}
      ${this.renderAiSuggestion()}
      ${this.renderFeedbackButtons()}
      ${this.renderFeedbackForm()}
      ${this.renderStats()}

      ${this.errorMessage ? html`
        <div class="error-message">${this.errorMessage}</div>
      ` : ''}

      ${this.successMessage ? html`
        <div class="success-message">${this.successMessage}</div>
      ` : ''}
    `;
  }
}

// Type definitions
interface YpFallacyLabel {
  id: number;
  fallacy_type: string;
  confidence_score: number;
  ai_explanation?: string;
  ai_suggestion?: string;
  status?: string;
  text_excerpt?: string;
}

interface YpFallacyFeedback {
  id: number;
  feedback_type: string;
  suggested_fallacy_type?: string;
  explanation?: string;
}

interface YpFallacyFeedbackStats {
  total: number;
  correct: number;
  false_positive: number;
  wrong_type: number;
  missed_fallacy: number;
  positive_percentage: number;
  negative_percentage: number;
  is_controversial: boolean;
}
