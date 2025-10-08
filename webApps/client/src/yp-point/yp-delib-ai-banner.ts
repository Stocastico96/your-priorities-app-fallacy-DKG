import { html, css, LitElement, nothing } from "lit";
import { property, customElement } from "lit/decorators.js";
import "@material/web/button/filled-button.js";
import "@material/web/button/text-button.js";
import "@material/web/chips/chip-set.js";
import "@material/web/chips/suggestion-chip.js";
import "@material/web/icon/icon.js";

interface DelibAiFallacy {
  label: string;
  score: number;
  rationale?: string;
}

interface DelibAiOntologyHints {
  jsonld?: any;
  explanations?: string[];
}

export interface DelibAiAnalysis {
  fallacies?: DelibAiFallacy[];
  ontologyHints?: DelibAiOntologyHints;
  perspectiveWarning?: boolean;
  suggestedRewrite?: string;
}

@customElement("yp-delib-ai-banner")
export class YpDelibAiBanner extends LitElement {
  @property({ type: Object })
  analysis: DelibAiAnalysis | undefined;

  @property({ type: Boolean })
  dismissed = false;

  override connectedCallback() {
    super.connectedCallback();
    console.log('[DelibAI Banner] Component connected, analysis:', this.analysis);
  }

  override updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    if (changedProperties.has('analysis')) {
      console.log('[DelibAI Banner] Analysis updated:', this.analysis);
    }
  }

  static override get styles() {
    return css`
      :host {
        display: block;
        margin: 16px 0;
        max-width: 100%;
        box-sizing: border-box;
      }

      .banner {
        background: #fff8e1;
        color: #4e342e;
        border-left: 4px solid #ff9800;
        border-radius: 8px;
        padding: 16px;
        margin: 12px 0;
        max-width: 100%;
        box-sizing: border-box;
        overflow-wrap: break-word;
        word-wrap: break-word;
      }

      @media (prefers-color-scheme: dark) {
        .banner {
          background: #332200;
          color: #ffe082;
        }
      }

      .banner.perspective-block {
        background: #ffebee;
        color: #c62828;
        border-left-color: #f44336;
      }

      @media (prefers-color-scheme: dark) {
        .banner.perspective-block {
          background: #4a0000;
          color: #ffcdd2;
        }
      }

      .banner-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-weight: 500;
        color: inherit;
      }

      .banner-content {
        margin: 12px 0;
        color: inherit;
      }

      .fallacy-item {
        margin: 8px 0;
        padding: 8px;
        background: rgba(0, 0, 0, 0.08);
        border-radius: 4px;
      }

      @media (prefers-color-scheme: dark) {
        .fallacy-item {
          background: rgba(255, 255, 255, 0.08);
        }
      }

      .fallacy-label {
        font-weight: 500;
        margin-bottom: 4px;
        color: inherit;
      }

      .fallacy-rationale {
        font-size: 0.9em;
        color: inherit;
        opacity: 0.8;
        overflow-wrap: break-word;
        word-wrap: break-word;
      }

      .rewrite-section {
        margin-top: 12px;
        padding: 12px;
        background: var(--md-sys-color-surface-variant);
        color: var(--md-sys-color-on-surface-variant);
        border-radius: 8px;
        max-width: 100%;
        box-sizing: border-box;
      }

      .rewrite-label {
        font-weight: 500;
        margin-bottom: 8px;
        color: var(--md-sys-color-on-surface-variant);
      }

      .rewrite-text {
        font-style: italic;
        padding: 8px;
        background: var(--md-sys-color-surface-container);
        color: var(--md-sys-color-on-surface);
        border-radius: 4px;
        overflow-wrap: break-word;
        word-wrap: break-word;
        white-space: pre-wrap;
      }

      .ontology-hints {
        margin-top: 12px;
        max-width: 100%;
        overflow: hidden;
      }

      .ontology-label {
        font-weight: 500;
        margin-bottom: 8px;
        color: inherit;
      }

      .hint-chip {
        margin: 4px;
      }

      md-chip-set {
        max-width: 100%;
        overflow-x: auto;
        flex-wrap: wrap;
      }

      .actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
        flex-wrap: wrap;
      }

      .actions md-filled-button {
        --md-filled-button-container-color: #ff9800;
        --md-filled-button-label-text-color: #000;
      }

      @media (prefers-color-scheme: dark) {
        .actions md-filled-button {
          --md-filled-button-container-color: #ffa726;
          --md-filled-button-label-text-color: #000;
        }
      }

      .actions md-text-button {
        --md-text-button-label-text-color: #e65100;
      }

      @media (prefers-color-scheme: dark) {
        .actions md-text-button {
          --md-text-button-label-text-color: #ffcc80;
        }
      }

      [hidden] {
        display: none !important;
      }
    `;
  }

  override render() {
    console.log('[DelibAI Banner] Rendering, dismissed:', this.dismissed, 'analysis:', this.analysis);
    if (this.dismissed || !this.analysis) return nothing;

    const hasFallacies =
      this.analysis.fallacies && this.analysis.fallacies.length > 0;
    const hasRewrite = !!this.analysis.suggestedRewrite;
    const hasOntology =
      this.analysis.ontologyHints?.explanations &&
      this.analysis.ontologyHints.explanations.length > 0;
    const isBlock = this.analysis.perspectiveWarning === true;

    console.log('[DelibAI Banner] Render checks:', { hasFallacies, hasRewrite, hasOntology, isBlock });
    // Show banner only if there are fallacies OR a perspective block warning
    if (!hasFallacies && !isBlock) {
      console.log('[DelibAI Banner] No fallacies or block warning, returning nothing');
      return nothing;
    }

    return html`
      <div class="banner ${isBlock ? "perspective-block" : ""}">
        <div class="banner-header">
          <md-icon>${isBlock ? "block" : "lightbulb"}</md-icon>
          <span
            >${isBlock
              ? "Contenuto problematico rilevato"
              : "Suggerimenti per migliorare il tuo contributo"}</span
          >
        </div>

        <div class="banner-content">
          ${hasFallacies
            ? html`
                <div class="fallacies">
                  <strong>Possibili problemi logici:</strong>
                  ${this.analysis.fallacies!.map(
                    (f) => html`
                      <div class="fallacy-item">
                        <div class="fallacy-label">${f.label}</div>
                        ${f.rationale
                          ? html`<div class="fallacy-rationale">
                              ${f.rationale}
                            </div>`
                          : nothing}
                      </div>
                    `
                  )}
                </div>
              `
            : nothing}
          ${hasRewrite
            ? html`
                <div class="rewrite-section">
                  <div class="rewrite-label">
                    Riformulazione suggerita dall'AI:
                  </div>
                  <div class="rewrite-text">
                    ${this.analysis.suggestedRewrite}
                  </div>
                </div>
              `
            : nothing}
          ${hasOntology
            ? html`
                <div class="ontology-hints">
                  <div class="ontology-label">
                    Elementi deliberativi rilevati:
                  </div>
                  <md-chip-set>
                    ${this.analysis.ontologyHints!.explanations!.map(
                      (hint: any) => html`
                        <md-suggestion-chip
                          class="hint-chip"
                          label="${hint.type || hint.explanation || (typeof hint === 'string' ? hint : JSON.stringify(hint))}">
                        </md-suggestion-chip>
                      `
                    )}
                  </md-chip-set>
                </div>
              `
            : nothing}
        </div>

        <div class="actions">
          ${hasRewrite && !isBlock
            ? html`
                <md-filled-button @click="${this._applyRewrite}">
                  Usa riformulazione
                </md-filled-button>
              `
            : nothing}
          <md-text-button @click="${this._dismiss}">
            ${isBlock ? "Ho capito" : "Pubblica comunque"}
          </md-text-button>
        </div>
      </div>
    `;
  }

  _applyRewrite() {
    this.dispatchEvent(
      new CustomEvent("apply-rewrite", {
        detail: { rewrite: this.analysis?.suggestedRewrite },
        bubbles: true,
        composed: true,
      })
    );
  }

  _dismiss() {
    this.dismissed = true;
    this.dispatchEvent(
      new CustomEvent("dismiss-banner", {
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "yp-delib-ai-banner": YpDelibAiBanner;
  }
}
