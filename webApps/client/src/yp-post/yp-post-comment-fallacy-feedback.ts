import { html, css, LitElement } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { YpBaseElement } from '../@yrpri/common/yp-base-element';
import '@material/web/button/text-button.js';
import '@material/web/button/filled-tonal-button.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/progress/linear-progress.js';

/**
 * Educational Fallacy Feedback Component
 * Displays fallacy detection results with comprehensive educational content
 * Non-judgmental, constructive, and engaging design
 */

interface FallacyDetection {
  fallacyType: string;
  fallacyName: string;
  confidence: number;
  confidenceLevel: string;
  severity: string;
  definition: string;
  whyProblematic: string;
  howToImprove: string[];
  betterExample: {
    before: string;
    after: string;
  };
  resourceLink: string;
  message: string;
}

@customElement('yp-post-comment-fallacy-feedback')
export class YpPostCommentFallacyFeedback extends YpBaseElement {
  @property({ type: Object })
  detection: FallacyDetection | null = null;

  @property({ type: Number })
  detectionId: number | null = null;

  @property({ type: Boolean })
  expanded: boolean = false;

  @property({ type: Boolean })
  userFeedbackSubmitted: boolean = false;

  static get styles() {
    return [
      super.styles,
      css`
        :host {
          display: block;
          margin: 8px 0;
          font-family: var(--md-sys-typescale-body-medium-font, Roboto, sans-serif);
        }

        .fallacy-container {
          background: var(--md-sys-color-surface-variant, #f5f5f5);
          border-left: 4px solid var(--fallacy-color, #ff9800);
          border-radius: 8px;
          padding: 12px;
          transition: all 0.3s ease;
        }

        .fallacy-container:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .fallacy-container.severity-high {
          --fallacy-color: #f44336;
        }

        .fallacy-container.severity-medium {
          --fallacy-color: #ff9800;
        }

        .fallacy-container.severity-low {
          --fallacy-color: #4caf50;
        }

        .fallacy-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          user-select: none;
        }

        .fallacy-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .fallacy-icon {
          background: var(--fallacy-color, #ff9800);
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .fallacy-title {
          flex: 1;
        }

        .fallacy-name {
          font-weight: 600;
          color: var(--md-sys-color-on-surface, #000);
          font-size: 16px;
        }

        .fallacy-subtitle {
          font-size: 13px;
          color: var(--md-sys-color-on-surface-variant, #666);
          margin-top: 2px;
        }

        .confidence-container {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 120px;
        }

        .confidence-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          background: var(--fallacy-color, #ff9800);
          color: white;
        }

        .expand-icon {
          transition: transform 0.3s ease;
        }

        .expand-icon.expanded {
          transform: rotate(180deg);
        }

        .fallacy-content {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--md-sys-color-outline-variant, #e0e0e0);
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .content-section {
          margin-bottom: 16px;
        }

        .section-title {
          font-weight: 600;
          color: var(--md-sys-color-primary, #1976d2);
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .section-content {
          color: var(--md-sys-color-on-surface, #333);
          line-height: 1.6;
          font-size: 14px;
        }

        .improvement-list {
          list-style: none;
          padding: 0;
          margin: 8px 0;
        }

        .improvement-list li {
          padding: 8px;
          margin: 4px 0;
          background: var(--md-sys-color-surface, #fff);
          border-radius: 6px;
          display: flex;
          gap: 8px;
        }

        .improvement-list li::before {
          content: '✓';
          color: var(--md-sys-color-primary, #1976d2);
          font-weight: bold;
          font-size: 16px;
        }

        .example-box {
          background: var(--md-sys-color-surface, #fff);
          border-radius: 8px;
          padding: 12px;
          margin: 8px 0;
        }

        .example-before,
        .example-after {
          margin: 8px 0;
        }

        .example-label {
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .example-before .example-label {
          color: #f44336;
        }

        .example-after .example-label {
          color: #4caf50;
        }

        .example-text {
          padding: 8px;
          border-radius: 4px;
          font-style: italic;
          font-size: 13px;
        }

        .example-before .example-text {
          background: #ffebee;
          border-left: 3px solid #f44336;
        }

        .example-after .example-text {
          background: #e8f5e9;
          border-left: 3px solid #4caf50;
        }

        .feedback-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--md-sys-color-outline-variant, #e0e0e0);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .feedback-question {
          font-size: 14px;
          color: var(--md-sys-color-on-surface-variant, #666);
        }

        .feedback-buttons {
          display: flex;
          gap: 8px;
        }

        .feedback-submitted {
          color: var(--md-sys-color-primary, #1976d2);
          font-size: 14px;
          font-weight: 500;
        }

        .learn-more-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--md-sys-color-primary, #1976d2);
          text-decoration: none;
          font-weight: 500;
          font-size: 14px;
          margin-top: 8px;
        }

        .learn-more-link:hover {
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .fallacy-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .confidence-container {
            align-self: flex-end;
          }

          .feedback-section {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `
    ];
  }

  toggleExpanded() {
    this.expanded = !this.expanded;
  }

  getSeverityClass(): string {
    if (!this.detection) return '';
    return `severity-${this.detection.severity}`;
  }

  getConfidenceColor(): string {
    if (!this.detection) return '#999';

    const confidence = this.detection.confidence;
    if (confidence >= 85) return '#4caf50';
    if (confidence >= 70) return '#ff9800';
    return '#f44336';
  }

  async handleFeedback(isHelpful: boolean) {
    if (!this.detectionId) return;

    try {
      const response = await fetch('/api/fallacy-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          detectionId: this.detectionId,
          isHelpful,
        }),
      });

      if (response.ok) {
        this.userFeedbackSubmitted = true;
        this.fire('feedback-submitted', { detectionId: this.detectionId, isHelpful });
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  }

  renderConfidenceBadge() {
    if (!this.detection) return '';

    const confidence = this.detection.confidence;
    return html`
      <div class="confidence-container">
        <div class="confidence-badge" style="background: ${this.getConfidenceColor()}">
          ${confidence}%
        </div>
      </div>
    `;
  }

  renderContent() {
    if (!this.detection || !this.expanded) return '';

    return html`
      <div class="fallacy-content">
        <!-- Definition -->
        <div class="content-section">
          <div class="section-title">
            <md-icon>info</md-icon>
            <span>What is this?</span>
          </div>
          <div class="section-content">
            ${this.detection.definition}
          </div>
        </div>

        <!-- Why Problematic -->
        <div class="content-section">
          <div class="section-title">
            <md-icon>warning</md-icon>
            <span>Why it matters</span>
          </div>
          <div class="section-content">
            ${this.detection.whyProblematic}
          </div>
        </div>

        <!-- How to Improve -->
        <div class="content-section">
          <div class="section-title">
            <md-icon>lightbulb</md-icon>
            <span>How to strengthen your argument</span>
          </div>
          <ul class="improvement-list">
            ${this.detection.howToImprove.map(tip => html`
              <li>${tip}</li>
            `)}
          </ul>
        </div>

        <!-- Example -->
        <div class="content-section">
          <div class="section-title">
            <md-icon>school</md-icon>
            <span>Example</span>
          </div>
          <div class="example-box">
            <div class="example-before">
              <div class="example-label">Weaker argument:</div>
              <div class="example-text">${this.detection.betterExample.before}</div>
            </div>
            <div class="example-after">
              <div class="example-label">Stronger argument:</div>
              <div class="example-text">${this.detection.betterExample.after}</div>
            </div>
          </div>
        </div>

        <!-- Learn More -->
        <div class="content-section">
          <a
            href="${this.detection.resourceLink}"
            target="_blank"
            rel="noopener noreferrer"
            class="learn-more-link"
          >
            <md-icon>open_in_new</md-icon>
            <span>Learn more about ${this.detection.fallacyName}</span>
          </a>
        </div>

        <!-- User Feedback -->
        ${this.renderFeedbackSection()}
      </div>
    `;
  }

  renderFeedbackSection() {
    if (!this.detectionId) return '';

    if (this.userFeedbackSubmitted) {
      return html`
        <div class="feedback-section">
          <div class="feedback-submitted">
            <md-icon style="vertical-align: middle;">check_circle</md-icon>
            Thank you for your feedback!
          </div>
        </div>
      `;
    }

    return html`
      <div class="feedback-section">
        <div class="feedback-question">
          Was this feedback helpful?
        </div>
        <div class="feedback-buttons">
          <md-text-button @click="${() => this.handleFeedback(true)}">
            <md-icon slot="icon">thumb_up</md-icon>
            Yes
          </md-text-button>
          <md-text-button @click="${() => this.handleFeedback(false)}">
            <md-icon slot="icon">thumb_down</md-icon>
            No
          </md-text-button>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.detection) return html``;

    return html`
      <div class="fallacy-container ${this.getSeverityClass()}">
        <div class="fallacy-header" @click="${this.toggleExpanded}">
          <div class="fallacy-badge">
            <div class="fallacy-icon">
              <md-icon>error_outline</md-icon>
            </div>
            <div class="fallacy-title">
              <div class="fallacy-name">${this.detection.fallacyName}</div>
              <div class="fallacy-subtitle">${this.detection.message}</div>
            </div>
          </div>
          ${this.renderConfidenceBadge()}
          <md-icon class="expand-icon ${this.expanded ? 'expanded' : ''}">
            expand_more
          </md-icon>
        </div>
        ${this.renderContent()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'yp-post-comment-fallacy-feedback': YpPostCommentFallacyFeedback;
  }
}
