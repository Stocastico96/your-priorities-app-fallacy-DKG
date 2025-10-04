import { html, css, LitElement, nothing } from "lit";
import { property, customElement, state } from "lit/decorators.js";
import "@material/web/dialog/dialog.js";
import "@material/web/button/filled-button.js";
import "@material/web/button/text-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/icon/icon.js";
import "@material/web/progress/circular-progress.js";
import { MdDialog } from "@material/web/dialog/dialog.js";
import { MdOutlinedTextField } from "@material/web/textfield/outlined-text-field.js";

interface FallacyComment {
  id: number;
  user_name: string;
  comment: string;
  created_at: string;
}

@customElement("yp-fallacy-comments-dialog")
export class YpFallacyCommentsDialog extends LitElement {
  @property({ type: Number })
  pointId: number | undefined;

  @property({ type: String })
  fallacyLabel: string | undefined;

  @state()
  private comments: FallacyComment[] = [];

  @state()
  private loading = false;

  @state()
  private submitting = false;

  @state()
  private newComment = "";

  static override get styles() {
    return css`
      md-dialog {
        --md-dialog-container-min-width: 500px;
        --md-dialog-container-max-width: 700px;
      }

      .dialog-content {
        padding: 16px 24px;
        max-height: 60vh;
        overflow-y: auto;
      }

      .fallacy-header {
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--md-sys-color-outline-variant, #e0e0e0);
      }

      .fallacy-title {
        font-size: 1.1em;
        font-weight: 500;
        color: var(--md-sys-color-warning, #ff9800);
        margin-bottom: 4px;
      }

      .fallacy-subtitle {
        font-size: 0.9em;
        opacity: 0.7;
      }

      .comment-form {
        margin-bottom: 24px;
        padding: 16px;
        background: var(--md-sys-color-surface-variant, #f5f5f5);
        border-radius: 8px;
      }

      .comment-input {
        width: 100%;
        margin-bottom: 12px;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .comments-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .comment-item {
        padding: 12px;
        background: white;
        border-radius: 8px;
        border-left: 3px solid var(--md-sys-color-primary, #1976d2);
      }

      .comment-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .comment-author {
        font-weight: 500;
        font-size: 0.9em;
      }

      .comment-date {
        font-size: 0.85em;
        opacity: 0.6;
      }

      .comment-text {
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .loading-container,
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px;
        opacity: 0.6;
      }

      .empty-state md-icon {
        font-size: 48px;
        margin-bottom: 8px;
      }

      [hidden] {
        display: none !important;
      }
    `;
  }

  async open() {
    const dialog = this.shadowRoot?.querySelector("md-dialog") as MdDialog;
    if (dialog) {
      dialog.show();
      await this._loadComments();
    }
  }

  close() {
    const dialog = this.shadowRoot?.querySelector("md-dialog") as MdDialog;
    if (dialog) {
      dialog.close();
    }
  }

  private async _loadComments() {
    if (!this.pointId || !this.fallacyLabel) return;

    this.loading = true;
    try {
      const response = await window.serverApi.getFallacyComments(
        this.pointId,
        this.fallacyLabel
      );
      this.comments = response.comments || [];
    } catch (error) {
      console.error("Failed to load fallacy comments:", error);
    } finally {
      this.loading = false;
    }
  }

  private async _submitComment() {
    if (!this.pointId || !this.fallacyLabel || !this.newComment.trim()) {
      return;
    }

    this.submitting = true;
    try {
      await window.serverApi.submitFallacyComment(
        this.pointId,
        this.fallacyLabel,
        this.newComment.trim()
      );

      // Clear input
      this.newComment = "";
      const input = this.shadowRoot?.querySelector(
        ".comment-input"
      ) as MdOutlinedTextField;
      if (input) {
        input.value = "";
      }

      // Reload comments
      await this._loadComments();

      // Notify parent to update comment count
      this.dispatchEvent(
        new CustomEvent("comment-added", {
          detail: { pointId: this.pointId, fallacyLabel: this.fallacyLabel },
          bubbles: true,
          composed: true,
        })
      );
    } catch (error) {
      console.error("Failed to submit fallacy comment:", error);
    } finally {
      this.submitting = false;
    }
  }

  private _handleInput(e: Event) {
    const input = e.target as MdOutlinedTextField;
    this.newComment = input.value;
  }

  private _formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "ora";
    if (diffMins < 60) return `${diffMins} minuti fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    if (diffDays < 7) return `${diffDays} giorni fa`;

    return date.toLocaleDateString("it-IT", {
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  override render() {
    return html`
      <md-dialog>
        <div slot="headline">
          <div class="fallacy-header">
            <div class="fallacy-title">${this.fallacyLabel}</div>
            <div class="fallacy-subtitle">
              Discussione sulla rilevazione di questa fallacia
            </div>
          </div>
        </div>

        <div slot="content" class="dialog-content">
          ${window.appUser?.loggedIn()
            ? html`
                <div class="comment-form">
                  <md-outlined-text-field
                    class="comment-input"
                    type="textarea"
                    rows="3"
                    label="Scrivi un commento..."
                    @input="${this._handleInput}"
                    .disabled="${this.submitting}"
                  ></md-outlined-text-field>
                  <div class="form-actions">
                    <md-filled-button
                      @click="${this._submitComment}"
                      .disabled="${this.submitting || !this.newComment.trim()}"
                    >
                      ${this.submitting
                        ? html`<md-circular-progress
                            indeterminate
                            slot="icon"
                          ></md-circular-progress>`
                        : nothing}
                      Pubblica
                    </md-filled-button>
                  </div>
                </div>
              `
            : html`
                <div class="comment-form" style="text-align: center;">
                  <p style="opacity: 0.7;">
                    Effettua il login per commentare
                  </p>
                </div>
              `}

          ${this.loading
            ? html`
                <div class="loading-container">
                  <md-circular-progress indeterminate></md-circular-progress>
                  <p>Caricamento commenti...</p>
                </div>
              `
            : this.comments.length > 0
            ? html`
                <div class="comments-list">
                  ${this.comments.map(
                    (comment) => html`
                      <div class="comment-item">
                        <div class="comment-header">
                          <span class="comment-author"
                            >${comment.user_name}</span
                          >
                          <span class="comment-date"
                            >${this._formatDate(comment.created_at)}</span
                          >
                        </div>
                        <div class="comment-text">${comment.comment}</div>
                      </div>
                    `
                  )}
                </div>
              `
            : html`
                <div class="empty-state">
                  <md-icon>chat_bubble_outline</md-icon>
                  <p>Nessun commento ancora. Sii il primo a commentare!</p>
                </div>
              `}
        </div>

        <div slot="actions">
          <md-text-button @click="${this.close}">Chiudi</md-text-button>
        </div>
      </md-dialog>
    `;
  }
}
