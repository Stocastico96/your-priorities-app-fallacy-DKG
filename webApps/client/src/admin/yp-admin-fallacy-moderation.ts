import { html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { YpBaseElement } from "../common/yp-base-element.js";

import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/progress/linear-progress.js";
import "@material/web/progress/circular-progress.js";
import "@material/web/list/list.js";
import "@material/web/list/list-item.js";
import "@material/web/divider/divider.js";
import "@material/web/dialog/dialog.js";

/**
 * YpAdminFallacyModeration
 *
 * Admin dashboard for reviewing and moderating controversial fallacy detections.
 * Allows moderators to:
 * - View fallacies with high dispute rates
 * - Override AI decisions
 * - Export feedback data for ML retraining
 */
@customElement("yp-admin-fallacy-moderation")
export class YpAdminFallacyModeration extends YpBaseElement {
  @property({ type: Number })
  groupId: number | undefined;

  @state()
  controversialFallacies: ControllerFallacyItem[] = [];

  @state()
  isLoading = false;

  @state()
  selectedFallacy: ControversialFallacyItem | null = null;

  @state()
  showOverrideDialog = false;

  @state()
  overrideStatus = "overridden";

  @state()
  overrideNotes = "";

  @state()
  currentPage = 0;

  @state()
  limit = 20;

  @state()
  totalCount = 0;

  @state()
  isExporting = false;

  @state()
  minFeedbacks = 3;

  static override styles = [
    super.styles,
    css`
      :host {
        display: block;
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
      }

      .header {
        margin-bottom: 24px;
      }

      h1 {
        font-size: 28px;
        font-weight: 500;
        margin: 0 0 8px 0;
        color: var(--md-sys-color-on-surface);
      }

      .subtitle {
        color: var(--md-sys-color-on-surface-variant);
        font-size: 14px;
      }

      .controls {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
        flex-wrap: wrap;
        align-items: center;
      }

      .control-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .control-label {
        font-size: 14px;
        color: var(--md-sys-color-on-surface-variant);
      }

      md-outlined-select {
        min-width: 120px;
      }

      .stats-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .stat-card {
        padding: 16px;
        background: var(--md-sys-color-surface-variant);
        border-radius: 12px;
      }

      .stat-value {
        font-size: 32px;
        font-weight: 600;
        color: var(--md-sys-color-primary);
        margin-bottom: 4px;
      }

      .stat-label {
        font-size: 14px;
        color: var(--md-sys-color-on-surface-variant);
      }

      .fallacy-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .fallacy-item {
        background: var(--md-sys-color-surface);
        border: 1px solid var(--md-sys-color-outline);
        border-radius: 12px;
        padding: 20px;
        transition: box-shadow 0.2s;
      }

      .fallacy-item:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .fallacy-header {
        display: flex;
        justify-content: space-between;
        align-items: start;
        margin-bottom: 12px;
      }

      .fallacy-type {
        font-size: 18px;
        font-weight: 600;
        color: var(--md-sys-color-error);
        margin-bottom: 4px;
      }

      .dispute-badge {
        padding: 4px 12px;
        border-radius: 16px;
        background: var(--md-sys-color-error-container);
        color: var(--md-sys-color-on-error-container);
        font-size: 13px;
        font-weight: 500;
      }

      .point-content {
        padding: 12px;
        background: var(--md-sys-color-surface-variant);
        border-radius: 8px;
        margin-bottom: 12px;
        font-size: 14px;
        line-height: 1.6;
      }

      .feedback-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }

      .feedback-stat {
        text-align: center;
        padding: 8px;
        background: var(--md-sys-color-surface-variant);
        border-radius: 8px;
      }

      .feedback-stat-value {
        font-size: 20px;
        font-weight: 600;
        color: var(--md-sys-color-primary);
      }

      .feedback-stat-label {
        font-size: 12px;
        color: var(--md-sys-color-on-surface-variant);
        margin-top: 4px;
      }

      .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 16px;
        margin-top: 24px;
      }

      .pagination-info {
        font-size: 14px;
        color: var(--md-sys-color-on-surface-variant);
      }

      .loading {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 48px;
      }

      .empty-state {
        text-align: center;
        padding: 48px;
        color: var(--md-sys-color-on-surface-variant);
      }

      .empty-icon {
        font-size: 64px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      .dialog-content {
        padding: 24px;
      }

      .form-field {
        margin-bottom: 16px;
      }

      md-outlined-text-field {
        width: 100%;
      }

      .dialog-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        padding: 16px 24px;
      }

      .export-section {
        margin-top: 32px;
        padding: 20px;
        background: var(--md-sys-color-tertiary-container);
        border-radius: 12px;
      }

      .export-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--md-sys-color-on-tertiary-container);
      }

      .export-description {
        font-size: 14px;
        color: var(--md-sys-color-on-tertiary-container);
        margin-bottom: 16px;
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    this.loadControversialFallacies();
  }

  async loadControversialFallacies() {
    this.isLoading = true;

    try {
      const offset = this.currentPage * this.limit;
      const response = await fetch(
        `/api/fallacy-feedback/controversial?limit=${this.limit}&offset=${offset}&minFeedbacks=${this.minFeedbacks}`
      );
      const data = await response.json();

      if (data.success) {
        this.controversialFallacies = data.controversialFallacies;
        this.totalCount = data.total;
      } else {
        console.error("Failed to load controversial fallacies:", data.error);
      }
    } catch (error) {
      console.error("Error loading controversial fallacies:", error);
    } finally {
      this.isLoading = false;
    }
  }

  getFallacyDisplayName(type: string): string {
    const names: Record<string, string> = {
      ad_hominem: "Ad Hominem",
      ad_populum: "Ad Populum",
      false_causality: "False Causality",
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

  handleOverrideClick(fallacy: ControversialFallacyItem) {
    this.selectedFallacy = fallacy;
    this.showOverrideDialog = true;
  }

  async submitOverride() {
    if (!this.selectedFallacy) return;

    try {
      const response = await fetch(
        `/api/fallacy-feedback/${this.selectedFallacy.fallacyLabel.id}/override`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: this.overrideStatus,
            notes: this.overrideNotes,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        this.showOverrideDialog = false;
        this.overrideNotes = "";
        this.loadControversialFallacies(); // Reload list
        this.fire("show-toast", { text: "Override applied successfully" });
      } else {
        this.fire("show-toast", { text: data.error || "Failed to apply override" });
      }
    } catch (error) {
      console.error("Error applying override:", error);
      this.fire("show-toast", { text: "An error occurred" });
    }
  }

  async exportFeedbackData() {
    this.isExporting = true;

    try {
      const response = await fetch('/api/fallacy-feedback/export');
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fallacy-feedback-export-${new Date().toISOString()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      this.fire("show-toast", { text: "Export completed successfully" });
    } catch (error) {
      console.error("Error exporting data:", error);
      this.fire("show-toast", { text: "Export failed" });
    } finally {
      this.isExporting = false;
    }
  }

  nextPage() {
    if ((this.currentPage + 1) * this.limit < this.totalCount) {
      this.currentPage++;
      this.loadControversialFallacies();
    }
  }

  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadControversialFallacies();
    }
  }

  renderStatCards() {
    const totalDisputed = this.totalCount;
    const avgDisputeRate = this.controversialFallacies.length > 0
      ? this.controversialFallacies.reduce((sum, f) => sum + f.feedbackStats.dispute_rate, 0) / this.controversialFallacies.length
      : 0;

    return html`
      <div class="stats-cards">
        <div class="stat-card">
          <div class="stat-value">${totalDisputed}</div>
          <div class="stat-label">Controversial Detections</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Math.round(avgDisputeRate)}%</div>
          <div class="stat-label">Avg Dispute Rate</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.controversialFallacies.length}</div>
          <div class="stat-label">Showing</div>
        </div>
      </div>
    `;
  }

  renderFallacyItem(item: ControversialFallacyItem) {
    const { fallacyLabel, point, feedbackStats } = item;

    return html`
      <div class="fallacy-item">
        <div class="fallacy-header">
          <div>
            <div class="fallacy-type">
              ${this.getFallacyDisplayName(fallacyLabel.fallacy_type)}
            </div>
            <div style="font-size: 12px; color: var(--md-sys-color-on-surface-variant);">
              ID: ${fallacyLabel.id} | Confidence: ${Math.round((fallacyLabel.confidence_score || 0) * 100)}%
            </div>
          </div>
          <div class="dispute-badge">
            ${Math.round(feedbackStats.dispute_rate)}% disputed
          </div>
        </div>

        <div class="point-content">
          ${point?.content || 'No content available'}
        </div>

        <div class="feedback-stats">
          <div class="feedback-stat">
            <div class="feedback-stat-value">${feedbackStats.total}</div>
            <div class="feedback-stat-label">Total</div>
          </div>
          <div class="feedback-stat">
            <div class="feedback-stat-value">${feedbackStats.correct}</div>
            <div class="feedback-stat-label">Correct</div>
          </div>
          <div class="feedback-stat">
            <div class="feedback-stat-value">${feedbackStats.false_positive}</div>
            <div class="feedback-stat-label">False Pos.</div>
          </div>
          <div class="feedback-stat">
            <div class="feedback-stat-value">${feedbackStats.wrong_type}</div>
            <div class="feedback-stat-label">Wrong Type</div>
          </div>
        </div>

        ${fallacyLabel.ai_explanation ? html`
          <div style="margin-bottom: 12px; padding: 8px; background: var(--md-sys-color-surface-variant); border-radius: 4px; font-size: 13px;">
            <strong>AI Explanation:</strong> ${fallacyLabel.ai_explanation}
          </div>
        ` : ''}

        <div class="actions">
          <md-outlined-button @click="${() => this.handleOverrideClick(item)}">
            Override Decision
          </md-outlined-button>
          <md-text-button>
            View Details
          </md-text-button>
        </div>
      </div>
    `;
  }

  renderOverrideDialog() {
    return html`
      <md-dialog ?open="${this.showOverrideDialog}" @close="${() => this.showOverrideDialog = false}">
        <div slot="headline">Override Fallacy Detection</div>
        <div slot="content" class="dialog-content">
          <div class="form-field">
            <md-outlined-select
              label="New Status"
              .value="${this.overrideStatus}"
              @change="${(e: any) => this.overrideStatus = e.target.value}"
            >
              <md-select-option value="overridden">Mark as Overridden</md-select-option>
              <md-select-option value="validated">Mark as Validated</md-select-option>
              <md-select-option value="disputed">Keep as Disputed</md-select-option>
            </md-outlined-select>
          </div>
          <div class="form-field">
            <md-outlined-text-field
              type="textarea"
              label="Moderator Notes"
              rows="4"
              .value="${this.overrideNotes}"
              @input="${(e: any) => this.overrideNotes = e.target.value}"
            ></md-outlined-text-field>
          </div>
        </div>
        <div slot="actions" class="dialog-actions">
          <md-text-button @click="${() => this.showOverrideDialog = false}">Cancel</md-text-button>
          <md-filled-button @click="${this.submitOverride}">Apply Override</md-filled-button>
        </div>
      </md-dialog>
    `;
  }

  override render() {
    return html`
      <div class="header">
        <h1>Fallacy Detection Moderation</h1>
        <div class="subtitle">
          Review and moderate controversial AI fallacy detections
        </div>
      </div>

      <div class="controls">
        <div class="control-group">
          <span class="control-label">Minimum Feedbacks:</span>
          <md-outlined-select
            .value="${this.minFeedbacks.toString()}"
            @change="${(e: any) => {
              this.minFeedbacks = parseInt(e.target.value);
              this.currentPage = 0;
              this.loadControversialFallacies();
            }}"
          >
            <md-select-option value="1">1+</md-select-option>
            <md-select-option value="3">3+</md-select-option>
            <md-select-option value="5">5+</md-select-option>
            <md-select-option value="10">10+</md-select-option>
          </md-outlined-select>
        </div>
        <md-filled-button @click="${() => this.loadControversialFallacies()}">
          Refresh
        </md-filled-button>
      </div>

      ${this.renderStatCards()}

      ${this.isLoading ? html`
        <div class="loading">
          <md-circular-progress indeterminate></md-circular-progress>
        </div>
      ` : this.controversialFallacies.length === 0 ? html`
        <div class="empty-state">
          <div class="empty-icon">✓</div>
          <div>No controversial fallacy detections found</div>
          <div style="font-size: 13px; margin-top: 8px;">
            All fallacy detections have community consensus
          </div>
        </div>
      ` : html`
        <div class="fallacy-list">
          ${this.controversialFallacies.map(item => this.renderFallacyItem(item))}
        </div>

        <div class="pagination">
          <md-outlined-button
            @click="${this.prevPage}"
            ?disabled="${this.currentPage === 0}"
          >
            Previous
          </md-outlined-button>
          <div class="pagination-info">
            Page ${this.currentPage + 1} of ${Math.ceil(this.totalCount / this.limit) || 1}
          </div>
          <md-outlined-button
            @click="${this.nextPage}"
            ?disabled="${(this.currentPage + 1) * this.limit >= this.totalCount}"
          >
            Next
          </md-outlined-button>
        </div>
      `}

      <div class="export-section">
        <div class="export-title">Export Feedback Data for ML Retraining</div>
        <div class="export-description">
          Download all fallacy feedback data in CSV format for model retraining and analysis.
        </div>
        <md-filled-button
          @click="${this.exportFeedbackData}"
          ?disabled="${this.isExporting}"
        >
          ${this.isExporting ? 'Exporting...' : 'Export to CSV'}
        </md-filled-button>
      </div>

      ${this.renderOverrideDialog()}
    `;
  }
}

// Type definitions
interface ControversialFallacyItem {
  fallacyLabel: any;
  point: any;
  feedbackStats: {
    total: number;
    correct: number;
    false_positive: number;
    wrong_type: number;
    missed_fallacy: number;
    positive_percentage: number;
    negative_percentage: number;
    dispute_rate: number;
  };
}
