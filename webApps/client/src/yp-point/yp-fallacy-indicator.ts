import { html, css, LitElement, nothing } from "lit";
import { property, customElement, query } from "lit/decorators.js";
import "@material/web/icon/icon.js";
import "@material/web/iconbutton/icon-button.js";
import "@material/web/button/text-button.js";
import "./yp-fallacy-comments-dialog.js";
import type { YpFallacyCommentsDialog } from "./yp-fallacy-comments-dialog.js";

interface DelibAiFallacy {
  label: string;
  score: number;
  rationale?: string;
}

@customElement("yp-fallacy-indicator")
export class YpFallacyIndicator extends LitElement {
  @property({ type: Number })
  pointId: number | undefined;

  @property({ type: Array })
  fallacies: DelibAiFallacy[] = [];

  @property({ type: Boolean })
  expanded = false;

  @property({ type: Object })
  feedbackState: Record<string, { helpful: boolean | null; commentCount: number }> = {};

  @query("yp-fallacy-comments-dialog")
  private commentsDialog!: YpFallacyCommentsDialog;

  static override get styles() {
    return css`
      :host {
        display: block;
        margin: 8px 0;
      }

      .fallacy-container {
        background: var(--md-sys-color-warning-container, #fff4e5);
        border-left: 3px solid var(--md-sys-color-warning, #ff9800);
        border-radius: 4px;
        padding: 8px 12px;
        margin: 4px 0;
      }

      .fallacy-trigger {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        user-select: none;
      }

      .fallacy-trigger:hover {
        opacity: 0.8;
      }

      .fallacy-icon {
        color: var(--md-sys-color-warning, #ff9800);
      }

      .fallacy-summary {
        flex: 1;
        font-size: 0.9em;
        font-weight: 500;
      }

      .expand-icon {
        transition: transform 0.2s;
      }

      .expand-icon.expanded {
        transform: rotate(180deg);
      }

      .fallacy-details {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
      }

      .fallacy-item {
        margin: 12px 0;
        padding: 8px;
        background: rgba(255, 255, 255, 0.6);
        border-radius: 4px;
      }

      .fallacy-header {
        display: flex;
        justify-content: space-between;
        align-items: start;
        margin-bottom: 8px;
      }

      .fallacy-label {
        font-weight: 500;
        color: var(--md-sys-color-on-warning-container, #3e2723);
      }

      .fallacy-score {
        font-size: 0.85em;
        opacity: 0.7;
        margin-left: 8px;
      }

      .fallacy-rationale {
        font-size: 0.9em;
        margin: 8px 0;
        line-height: 1.4;
      }

      .fallacy-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(0, 0, 0, 0.05);
      }

      .feedback-label {
        font-size: 0.85em;
        margin-right: 4px;
        opacity: 0.7;
      }

      .feedback-btn {
        --md-icon-button-icon-size: 18px;
      }

      .feedback-btn.active {
        color: var(--md-sys-color-primary, #1976d2);
      }

      .comment-count {
        font-size: 0.85em;
        margin-left: 8px;
        opacity: 0.7;
      }

      [hidden] {
        display: none !important;
      }
    `;
  }

  _toggleExpand() {
    this.expanded = !this.expanded;
  }

  async _handleFeedback(fallacyLabel: string, helpful: boolean) {
    // Toggle: if clicking the same button, remove feedback
    const currentValue = this.feedbackState[fallacyLabel]?.helpful;
    const newValue = currentValue === helpful ? null : helpful;

    // Update local state optimistically
    this.feedbackState = {
      ...this.feedbackState,
      [fallacyLabel]: {
        helpful: newValue,
        commentCount: this.feedbackState[fallacyLabel]?.commentCount || 0,
      },
    };
    this.requestUpdate();

    // Call API
    try {
      if (newValue !== null) {
        await window.serverApi.submitFallacyFeedback(
          this.pointId!,
          fallacyLabel,
          newValue
        );
      }
    } catch (error) {
      console.error("Failed to submit fallacy feedback:", error);
      // Revert on error
      this.feedbackState = {
        ...this.feedbackState,
        [fallacyLabel]: {
          helpful: currentValue,
          commentCount: this.feedbackState[fallacyLabel]?.commentCount || 0,
        },
      };
      this.requestUpdate();
    }
  }

  _openComments(fallacyLabel: string) {
    if (this.commentsDialog) {
      this.commentsDialog.pointId = this.pointId;
      this.commentsDialog.fallacyLabel = fallacyLabel;
      this.commentsDialog.open();
    }
  }

  override async connectedCallback() {
    super.connectedCallback();
    // Load comment counts when component is connected
    if (this.pointId) {
      await this._loadCommentCounts();
    }
  }

  private async _loadCommentCounts() {
    if (!this.pointId) return;

    try {
      const response = await window.serverApi.getFallacyCommentCounts(this.pointId);
      const counts = response.counts || {};

      // Update feedbackState with comment counts
      const newState: Record<string, { helpful: boolean | null; commentCount: number }> = {};
      this.fallacies.forEach(fallacy => {
        newState[fallacy.label] = {
          helpful: this.feedbackState[fallacy.label]?.helpful || null,
          commentCount: counts[fallacy.label] || 0
        };
      });
      this.feedbackState = newState;
      this.requestUpdate();
    } catch (error) {
      console.error("Failed to load comment counts:", error);
    }
  }

  private _handleCommentAdded() {
    // Reload comment counts when a new comment is added
    this._loadCommentCounts();
  }

  override render() {
    if (!this.fallacies || this.fallacies.length === 0) {
      return nothing;
    }

    const fallacyCount = this.fallacies.length;
    const summaryText =
      fallacyCount === 1
        ? `1 possibile fallacia rilevata`
        : `${fallacyCount} possibili fallacie rilevate`;

    return html`
      <div class="fallacy-container">
        <div class="fallacy-trigger" @click="${this._toggleExpand}">
          <md-icon class="fallacy-icon">warning</md-icon>
          <span class="fallacy-summary">${summaryText}</span>
          <md-icon class="expand-icon ${this.expanded ? "expanded" : ""}">
            expand_more
          </md-icon>
        </div>

        ${this.expanded
          ? html`
              <div class="fallacy-details">
                ${this.fallacies.map((fallacy) => {
                  const feedback = this.feedbackState[fallacy.label];
                  return html`
                    <div class="fallacy-item">
                      <div class="fallacy-header">
                        <div>
                          <span class="fallacy-label">${fallacy.label}</span>
                          <span class="fallacy-score">
                            (confidenza: ${Math.round(fallacy.score * 100)}%)
                          </span>
                        </div>
                      </div>
                      ${fallacy.rationale
                        ? html`
                            <div class="fallacy-rationale">
                              ${fallacy.rationale}
                            </div>
                          `
                        : nothing}
                      <div class="fallacy-actions">
                        <span class="feedback-label">Accurato?</span>
                        <md-icon-button
                          class="feedback-btn ${feedback?.helpful === true
                            ? "active"
                            : ""}"
                          @click="${() =>
                            this._handleFeedback(fallacy.label, true)}"
                        >
                          <md-icon>thumb_up</md-icon>
                        </md-icon-button>
                        <md-icon-button
                          class="feedback-btn ${feedback?.helpful === false
                            ? "active"
                            : ""}"
                          @click="${() =>
                            this._handleFeedback(fallacy.label, false)}"
                        >
                          <md-icon>thumb_down</md-icon>
                        </md-icon-button>
                        <md-text-button
                          @click="${() => this._openComments(fallacy.label)}"
                        >
                          <md-icon slot="icon">comment</md-icon>
                          Commenta
                          ${feedback?.commentCount
                            ? html`<span class="comment-count"
                                >(${feedback.commentCount})</span
                              >`
                            : nothing}
                        </md-text-button>
                      </div>
                    </div>
                  `;
                })}
              </div>
            `
          : nothing}
      </div>

      <yp-fallacy-comments-dialog
        @comment-added="${this._handleCommentAdded}"
      ></yp-fallacy-comments-dialog>
    `;
  }
}
