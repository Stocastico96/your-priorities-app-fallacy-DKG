import { html, css, nothing, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/progress/circular-progress.js";
import "@material/web/iconbutton/icon-button.js";
import "@material/web/icon/icon.js";

/**
 * yp-argument-assistant
 *
 * AI-powered argument enhancement assistant for deliberative democracy
 * Provides real-time feedback and suggestions to improve argument quality
 *
 * Features:
 * - Analyzes argument structure (claim, evidence, warrant, etc.)
 * - Provides specific, actionable suggestions
 * - Shows strength score and level
 * - One-click suggestion templates
 * - Debounced auto-analysis option
 * - Multilingual support
 *
 * @fires suggestion-applied - When user applies a suggestion
 * @fires feedback-submitted - When user provides feedback on suggestions
 */
@customElement("yp-argument-assistant")
export class YpArgumentAssistant extends LitElement {
  @property({ type: String })
  text = "";

  @property({ type: Number })
  postId: number | undefined;

  @property({ type: Boolean })
  autoAnalyze = false;

  @property({ type: Number })
  autoAnalyzeDelay = 5000; // 5 seconds

  @state()
  analysis: ArgumentAnalysis | null = null;

  @state()
  isAnalyzing = false;

  @state()
  error: string | null = null;

  @state()
  quickFeedback: QuickFeedback | null = null;

  @state()
  expanded = false;

  private debounceTimer: number | null = null;
  private apiBasePath = "/api/points";

  static override styles = css`
    :host {
      display: block;
      font-family: var(--md-sys-typescale-body-medium-font, Roboto);
    }

    .container {
      border: 1px solid var(--md-sys-color-outline-variant, #ccc);
      border-radius: 12px;
      padding: 16px;
      margin: 16px 0;
      background: var(--md-sys-color-surface-variant, #f5f5f5);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 500;
      color: var(--md-sys-color-on-surface, #000);
    }

    .sparkle-icon {
      color: var(--md-sys-color-primary, #6750a4);
    }

    .actions {
      display: flex;
      gap: 8px;
    }

    .strength-indicator {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 12px 0;
      padding: 12px;
      border-radius: 8px;
      background: var(--md-sys-color-surface, white);
    }

    .strength-score {
      font-size: 24px;
      font-weight: 700;
      min-width: 40px;
      text-align: center;
    }

    .strength-score.weak {
      color: var(--md-sys-color-error, #b3261e);
    }

    .strength-score.moderate {
      color: var(--md-sys-color-tertiary, #7d5260);
    }

    .strength-score.strong {
      color: var(--md-sys-color-primary, #6750a4);
    }

    .strength-bar {
      flex: 1;
      height: 8px;
      background: var(--md-sys-color-surface-variant, #e0e0e0);
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }

    .strength-fill {
      height: 100%;
      transition: width 0.3s ease;
      border-radius: 4px;
    }

    .strength-fill.weak {
      background: var(--md-sys-color-error, #b3261e);
    }

    .strength-fill.moderate {
      background: var(--md-sys-color-tertiary, #7d5260);
    }

    .strength-fill.strong {
      background: var(--md-sys-color-primary, #6750a4);
    }

    .strength-label {
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .components {
      margin: 16px 0;
    }

    .component-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
      margin-top: 8px;
    }

    .component-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--md-sys-color-surface, white);
      font-size: 14px;
    }

    .component-icon {
      font-size: 18px;
    }

    .component-icon.present {
      color: var(--md-sys-color-primary, #6750a4);
    }

    .component-icon.missing {
      color: var(--md-sys-color-outline, #79747e);
    }

    .component-name {
      text-transform: capitalize;
      color: var(--md-sys-color-on-surface, #000);
    }

    .suggestions {
      margin: 16px 0;
    }

    .suggestions-title {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 12px;
      color: var(--md-sys-color-on-surface, #000);
    }

    .suggestion-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      margin-bottom: 8px;
      border-radius: 8px;
      background: var(--md-sys-color-surface, white);
      border-left: 3px solid transparent;
    }

    .suggestion-item.high {
      border-left-color: var(--md-sys-color-error, #b3261e);
    }

    .suggestion-item.medium {
      border-left-color: var(--md-sys-color-tertiary, #7d5260);
    }

    .suggestion-item.low {
      border-left-color: var(--md-sys-color-outline, #79747e);
    }

    .suggestion-content {
      flex: 1;
    }

    .suggestion-message {
      font-size: 14px;
      line-height: 1.5;
      color: var(--md-sys-color-on-surface, #000);
      margin-bottom: 4px;
    }

    .suggestion-example {
      font-size: 13px;
      font-style: italic;
      color: var(--md-sys-color-on-surface-variant, #49454f);
      margin-top: 8px;
      padding: 8px;
      background: var(--md-sys-color-surface-variant, #f5f5f5);
      border-radius: 4px;
    }

    .suggestion-type {
      display: inline-block;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
      background: var(--md-sys-color-secondary-container, #e8def8);
      color: var(--md-sys-color-on-secondary-container, #1d192b);
      text-transform: uppercase;
      font-weight: 500;
    }

    .summary {
      margin: 16px 0;
      padding: 12px;
      border-radius: 8px;
      background: var(--md-sys-color-primary-container, #eaddff);
      color: var(--md-sys-color-on-primary-container, #21005d);
      font-size: 14px;
      line-height: 1.5;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 24px;
      color: var(--md-sys-color-on-surface-variant, #49454f);
    }

    .error {
      padding: 12px;
      border-radius: 8px;
      background: var(--md-sys-color-error-container, #f9dedc);
      color: var(--md-sys-color-on-error-container, #410e0b);
      font-size: 14px;
    }

    .quick-feedback {
      font-size: 13px;
      color: var(--md-sys-color-on-surface-variant, #49454f);
      padding: 8px;
      margin-bottom: 8px;
    }

    .feedback-actions {
      display: flex;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--md-sys-color-outline-variant, #ccc);
    }

    .collapsed-preview {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      transition: background 0.2s;
    }

    .collapsed-preview:hover {
      background: var(--md-sys-color-surface, white);
    }

    .preview-score {
      font-size: 18px;
      font-weight: 600;
    }

    .preview-text {
      flex: 1;
      font-size: 14px;
      color: var(--md-sys-color-on-surface-variant, #49454f);
    }

    md-circular-progress {
      --md-circular-progress-size: 24px;
    }

    @media (max-width: 600px) {
      .component-list {
        grid-template-columns: 1fr;
      }
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    if (this.autoAnalyze && this.text) {
      this.scheduleAutoAnalysis();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer);
    }
  }

  override updated(changedProperties: Map<string, any>) {
    if (changedProperties.has("text") && this.autoAnalyze) {
      this.scheduleAutoAnalysis();
    }
  }

  private scheduleAutoAnalysis() {
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.analyzeArgument();
    }, this.autoAnalyzeDelay);
  }

  async analyzeArgument() {
    if (!this.text || this.text.trim().length === 0) {
      this.error = "Please enter some text to analyze";
      return;
    }

    this.isAnalyzing = true;
    this.error = null;
    this.expanded = true;

    try {
      const response = await fetch(`${this.apiBasePath}/enhance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: this.text,
          postId: this.postId,
          language: navigator.language,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Too many requests. Please wait a moment and try again.");
        }
        throw new Error("Failed to analyze argument");
      }

      const data = await response.json();

      if (data.error) {
        this.error = data.error;
        this.analysis = null;
      } else {
        this.analysis = data as ArgumentAnalysis;
        this.error = null;
      }
    } catch (error: any) {
      this.error = error.message || "Failed to analyze argument. Please try again.";
      this.analysis = null;
    } finally {
      this.isAnalyzing = false;
    }
  }

  async getQuickFeedback() {
    if (!this.text || this.text.trim().length < 10) {
      return;
    }

    try {
      const response = await fetch(`${this.apiBasePath}/enhance/quick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: this.text }),
      });

      if (response.ok) {
        this.quickFeedback = await response.json();
      }
    } catch (error) {
      // Silently fail for quick feedback
      console.warn("Quick feedback failed:", error);
    }
  }

  private applySuggestion(suggestion: ArgumentSuggestion) {
    this.dispatchEvent(
      new CustomEvent("suggestion-applied", {
        detail: suggestion,
        bubbles: true,
        composed: true,
      })
    );
  }

  private submitFeedback(helpful: boolean) {
    this.dispatchEvent(
      new CustomEvent("feedback-submitted", {
        detail: { helpful, analysis: this.analysis },
        bubbles: true,
        composed: true,
      })
    );
  }

  private toggleExpanded() {
    this.expanded = !this.expanded;
  }

  private renderStrengthIndicator() {
    if (!this.analysis) return nothing;

    const { strengthScore, strengthLevel } = this.analysis;
    const percentage = (strengthScore / 10) * 100;

    return html`
      <div class="strength-indicator">
        <div class="strength-score ${strengthLevel}">
          ${strengthScore}<span style="font-size: 14px">/10</span>
        </div>
        <div class="strength-bar">
          <div
            class="strength-fill ${strengthLevel}"
            style="width: ${percentage}%"
          ></div>
        </div>
        <div class="strength-label">${strengthLevel}</div>
      </div>
    `;
  }

  private renderComponents() {
    if (!this.analysis?.components) return nothing;

    const componentTypes = [
      { key: "claim", label: "Claim" },
      { key: "evidence", label: "Evidence" },
      { key: "warrant", label: "Reasoning" },
      { key: "qualifiers", label: "Qualifiers" },
      { key: "backing", label: "Backing" },
      { key: "rebuttals", label: "Counterarguments" },
    ];

    return html`
      <div class="components">
        <div class="suggestions-title">Argument Components</div>
        <div class="component-list">
          ${componentTypes.map((type) => {
            const component = this.analysis!.components[type.key];
            const present = component?.present || false;
            return html`
              <div class="component-item">
                <md-icon class="component-icon ${present ? "present" : "missing"}">
                  ${present ? "check_circle" : "radio_button_unchecked"}
                </md-icon>
                <span class="component-name">${type.label}</span>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private renderSuggestions() {
    if (!this.analysis?.suggestions || this.analysis.suggestions.length === 0) {
      return nothing;
    }

    return html`
      <div class="suggestions">
        <div class="suggestions-title">
          Suggestions for Improvement (${this.analysis.suggestions.length})
        </div>
        ${this.analysis.suggestions.map(
          (suggestion) => html`
            <div class="suggestion-item ${suggestion.priority}">
              <div class="suggestion-content">
                <div>
                  <span class="suggestion-type">${suggestion.type}</span>
                </div>
                <div class="suggestion-message">${suggestion.message}</div>
                ${suggestion.example
                  ? html`<div class="suggestion-example">
                      Example: ${suggestion.example}
                    </div>`
                  : nothing}
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  private renderCollapsedPreview() {
    if (!this.analysis) return nothing;

    return html`
      <div class="collapsed-preview" @click=${this.toggleExpanded}>
        <div class="preview-score ${this.analysis.strengthLevel}">
          ${this.analysis.strengthScore}/10
        </div>
        <div class="preview-text">
          ${this.analysis.suggestions.length} suggestions available
        </div>
        <md-icon>expand_more</md-icon>
      </div>
    `;
  }

  override render() {
    return html`
      <div class="container">
        <div class="header">
          <div class="title">
            <md-icon class="sparkle-icon">auto_awesome</md-icon>
            <span>AI Argument Assistant</span>
          </div>
          ${this.analysis && !this.expanded
            ? html`
                <md-icon-button @click=${this.toggleExpanded}>
                  <md-icon>expand_more</md-icon>
                </md-icon-button>
              `
            : nothing}
        </div>

        ${this.quickFeedback
          ? html`<div class="quick-feedback">
              ${this.quickFeedback.lengthFeedback}
            </div>`
          : nothing}

        ${this.isAnalyzing
          ? html`
              <div class="loading">
                <md-circular-progress indeterminate></md-circular-progress>
                <span>Analyzing your argument...</span>
              </div>
            `
          : nothing}

        ${this.error
          ? html`<div class="error">${this.error}</div>`
          : nothing}

        ${!this.isAnalyzing && this.analysis && !this.expanded
          ? this.renderCollapsedPreview()
          : nothing}

        ${!this.isAnalyzing && this.analysis && this.expanded
          ? html`
              ${this.analysis.summary
                ? html`<div class="summary">${this.analysis.summary}</div>`
                : nothing}
              ${this.renderStrengthIndicator()} ${this.renderComponents()}
              ${this.renderSuggestions()}
              <div class="feedback-actions">
                <md-text-button @click=${() => this.submitFeedback(true)}>
                  <md-icon slot="icon">thumb_up</md-icon>
                  Helpful
                </md-text-button>
                <md-text-button @click=${() => this.submitFeedback(false)}>
                  <md-icon slot="icon">thumb_down</md-icon>
                  Not Helpful
                </md-text-button>
                <md-text-button @click=${this.toggleExpanded}>
                  <md-icon slot="icon">expand_less</md-icon>
                  Collapse
                </md-text-button>
              </div>
            `
          : nothing}

        ${!this.analysis && !this.isAnalyzing && !this.error
          ? html`
              <div class="actions">
                <md-outlined-button @click=${this.analyzeArgument}>
                  <md-icon slot="icon">auto_awesome</md-icon>
                  Get AI Suggestions
                </md-outlined-button>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

// Type definitions
interface ArgumentAnalysis {
  components: {
    [key: string]: {
      present: boolean;
      text: string | null;
      strength: number;
    };
  };
  strengthScore: number;
  strengthLevel: "weak" | "moderate" | "strong";
  suggestions: ArgumentSuggestion[];
  summary: string;
  metadata?: {
    processingTime?: number;
    model?: string;
    textLength?: number;
  };
}

interface ArgumentSuggestion {
  type: string;
  priority: "high" | "medium" | "low";
  message: string;
  example?: string;
  id: number;
}

interface QuickFeedback {
  wordCount: number;
  sentenceCount: number;
  lengthFeedback: string | null;
  basicSuggestions: string[];
}

declare global {
  interface HTMLElementTagNameMap {
    "yp-argument-assistant": YpArgumentAssistant;
  }
}
