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
        background: var(--md-sys-color-warning-container, #fff4e5);
        color: var(--md-sys-color-on-warning-container, #3e2723);
        border-left: 4px solid var(--md-sys-color-warning, #ff9800);
        border-radius: 8px;
        padding: 16px;
        margin: 12px 0;
        max-width: 100%;
        box-sizing: border-box;
        overflow-wrap: break-word;
        word-wrap: break-word;
      }

      .banner.perspective-block {
        background: var(--md-sys-color-error-container, #ffebee);
        border-left-color: var(--md-sys-color-error, #f44336);
      }

      .banner-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-weight: 500;
      }

      .banner-content {
        margin: 12px 0;
      }

      .fallacy-item {
        margin: 8px 0;
        padding: 8px;
        background: rgba(0, 0, 0, 0.03);
        border-radius: 4px;
      }

      .fallacy-label {
        font-weight: 500;
        margin-bottom: 4px;
      }

      .fallacy-rationale {
        font-size: 0.9em;
        opacity: 0.8;
        overflow-wrap: break-word;
        word-wrap: break-word;
      }

      .rewrite-section {
        margin-top: 12px;
        padding: 12px;
        background: var(--md-sys-color-surface-variant, #f5f5f5);
        border-radius: 8px;
        max-width: 100%;
        box-sizing: border-box;
      }

      .rewrite-label {
        font-weight: 500;
        margin-bottom: 8px;
      }

      .rewrite-text {
        font-style: italic;
        padding: 8px;
        background: white;
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
    if (!hasFallacies && !hasRewrite && !hasOntology) {
      console.log('[DelibAI Banner] No content to show, returning nothing');
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
