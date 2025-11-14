import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { YpBaseElement } from "../common/yp-base-element.js";

/**
 * Perspectivized Stance Vector Radar Chart
 * Displays a user's stance across multiple dimensions compared to community average
 */
@customElement("yp-stance-radar")
export class YpStanceRadar extends YpBaseElement {
  @property({ type: Number })
  postId: number | undefined;

  @property({ type: Number })
  pointId: number | undefined;

  @property({ type: Object })
  stanceData: any = null;

  @property({ type: Object })
  aggregateData: any = null;

  @property({ type: Boolean })
  loading = false;

  @property({ type: String })
  error: string | undefined;

  static override get styles() {
    return [
      super.styles,
      css`
        :host {
          display: block;
          padding: 16px;
        }

        .container {
          max-width: 600px;
          margin: 0 auto;
        }

        .chart-container {
          position: relative;
          width: 100%;
          max-width: 500px;
          margin: 24px auto;
        }

        canvas {
          max-width: 100%;
          height: auto;
        }

        .legend {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-top: 16px;
          flex-wrap: wrap;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .legend-color {
          width: 20px;
          height: 20px;
          border-radius: 4px;
        }

        .user-stance {
          background-color: rgba(54, 162, 235, 0.8);
        }

        .community-average {
          background-color: rgba(255, 99, 132, 0.8);
        }

        .dimensions-list {
          margin-top: 24px;
        }

        .dimension-item {
          padding: 12px;
          margin-bottom: 8px;
          background: var(--md-sys-color-surface-variant);
          border-radius: 8px;
        }

        .dimension-name {
          font-weight: 500;
          margin-bottom: 4px;
        }

        .dimension-description {
          font-size: 0.9em;
          color: var(--md-sys-color-on-surface-variant);
          margin-bottom: 8px;
        }

        .stance-bar {
          position: relative;
          height: 24px;
          background: linear-gradient(
            to right,
            #d32f2f 0%,
            #f57c00 25%,
            #fbc02d 50%,
            #7cb342 75%,
            #388e3c 100%
          );
          border-radius: 4px;
          margin-bottom: 4px;
        }

        .stance-marker {
          position: absolute;
          top: -4px;
          width: 4px;
          height: 32px;
          background: #000;
          border-radius: 2px;
          transform: translateX(-2px);
        }

        .stance-value {
          font-size: 0.85em;
          color: var(--md-sys-color-on-surface);
          margin-top: 4px;
        }

        .agreement-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.8em;
          margin-left: 8px;
        }

        .strong-agreement {
          background-color: rgba(76, 175, 80, 0.2);
          color: #2e7d32;
        }

        .partial-agreement {
          background-color: rgba(139, 195, 74, 0.2);
          color: #558b2f;
        }

        .orthogonal {
          background-color: rgba(158, 158, 158, 0.2);
          color: #424242;
        }

        .partial-opposition {
          background-color: rgba(255, 152, 0, 0.2);
          color: #e65100;
        }

        .strong-opposition {
          background-color: rgba(244, 67, 54, 0.2);
          color: #c62828;
        }

        .loading {
          text-align: center;
          padding: 32px;
        }

        .error {
          color: var(--md-sys-color-error);
          padding: 16px;
          text-align: center;
        }

        h3 {
          margin-top: 0;
          margin-bottom: 16px;
        }

        .scale-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.75em;
          color: var(--md-sys-color-on-surface-variant);
          margin-top: 4px;
        }
      `,
    ];
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.pointId) {
      this.loadStanceData();
    } else if (this.postId) {
      this.loadAggregateData();
    }
  }

  async loadStanceData() {
    this.loading = true;
    this.error = undefined;

    try {
      const response = await fetch(
        `/api/points/${this.pointId}/stance-vector`
      );

      if (!response.ok) {
        throw new Error("Failed to load stance data");
      }

      const data = await response.json();
      this.stanceData = data;

      // Also load aggregate data for comparison
      if (data.vector && data.vector.length > 0) {
        await this.loadAggregateDataForComparison();
      }
    } catch (error: any) {
      this.error = error.message;
      console.error("Error loading stance data:", error);
    } finally {
      this.loading = false;
    }
  }

  async loadAggregateData() {
    this.loading = true;
    this.error = undefined;

    try {
      const response = await fetch(
        `/api/posts/${this.postId}/stance-analysis`
      );

      if (!response.ok) {
        throw new Error("Failed to load aggregate stance data");
      }

      const data = await response.json();
      this.aggregateData = data.aggregate;
    } catch (error: any) {
      this.error = error.message;
      console.error("Error loading aggregate data:", error);
    } finally {
      this.loading = false;
    }
  }

  async loadAggregateDataForComparison() {
    try {
      // Get post ID from the point
      const pointResponse = await fetch(`/api/points/${this.pointId}`);
      if (!pointResponse.ok) return;

      const pointData = await pointResponse.json();
      const postId = pointData.Post?.id;

      if (!postId) return;

      const response = await fetch(`/api/posts/${postId}/stance-analysis`);
      if (!response.ok) return;

      const data = await response.json();
      this.aggregateData = data.aggregate;
    } catch (error) {
      console.error("Error loading aggregate data for comparison:", error);
    }
  }

  getAgreementClass(dimension: any) {
    if (!this.aggregateData || !this.aggregateData.success) return "";

    const aggregate = this.aggregateData.aggregateStances?.find(
      (a: any) => a.dimensionName === dimension.dimension
    );

    if (!aggregate) return "";

    const userStance = dimension.stanceValue;
    const avgStance = aggregate.averageStance;
    const diff = Math.abs(userStance - avgStance);

    if (diff < 0.2) return "strong-agreement";
    if (diff < 0.4) return "partial-agreement";
    if (diff < 0.6) return "orthogonal";
    if (diff < 0.8) return "partial-opposition";
    return "strong-opposition";
  }

  getAgreementLabel(agreementClass: string) {
    switch (agreementClass) {
      case "strong-agreement":
        return "Strong alignment";
      case "partial-agreement":
        return "Partial alignment";
      case "orthogonal":
        return "Different focus";
      case "partial-opposition":
        return "Some disagreement";
      case "strong-opposition":
        return "Strong disagreement";
      default:
        return "";
    }
  }

  renderDimensionBar(dimension: any) {
    const stanceValue = dimension.stanceValue;
    const position = ((stanceValue + 1) / 2) * 100; // Convert -1..1 to 0..100

    return html`
      <div class="dimension-item">
        <div class="dimension-name">
          ${dimension.dimension}
          ${this.aggregateData?.success
            ? html`<span
                class="agreement-badge ${this.getAgreementClass(dimension)}"
              >
                ${this.getAgreementLabel(this.getAgreementClass(dimension))}
              </span>`
            : nothing}
        </div>
        <div class="stance-bar">
          <div
            class="stance-marker"
            style="left: ${position}%"
            title="Your stance: ${stanceValue.toFixed(2)}"
          ></div>
        </div>
        <div class="scale-labels">
          <span>Negative</span>
          <span>Neutral</span>
          <span>Positive</span>
        </div>
        <div class="stance-value">
          Value: ${stanceValue.toFixed(2)} | Confidence:
          ${(dimension.confidence * 100).toFixed(0)}%
        </div>
        ${dimension.explanation
          ? html`<div class="dimension-description">
              ${dimension.explanation}
            </div>`
          : nothing}
      </div>
    `;
  }

  renderStanceVisualization() {
    if (!this.stanceData || !this.stanceData.vector) {
      return html`<div class="error">No stance data available</div>`;
    }

    return html`
      <div class="container">
        <h3>Your Stance Analysis</h3>
        <div class="dimensions-list">
          ${this.stanceData.vector.map((dimension: any) =>
            this.renderDimensionBar(dimension)
          )}
        </div>
        ${this.aggregateData?.success
          ? html`
              <div style="margin-top: 24px; font-size: 0.9em; color: var(--md-sys-color-on-surface-variant);">
                <strong>Note:</strong> The badges indicate how your stance
                compares to the community average on each dimension.
              </div>
            `
          : nothing}
      </div>
    `;
  }

  renderAggregateVisualization() {
    if (!this.aggregateData || !this.aggregateData.success) {
      return html`<div class="error">No aggregate data available</div>`;
    }

    return html`
      <div class="container">
        <h3>Community Stance Distribution</h3>
        <div class="dimensions-list">
          ${this.aggregateData.aggregateStances.map(
            (dimension: any) => html`
              <div class="dimension-item">
                <div class="dimension-name">${dimension.dimensionName}</div>
                <div class="stance-bar">
                  <div
                    class="stance-marker"
                    style="left: ${((dimension.averageStance + 1) / 2) *
                    100}%"
                    title="Average: ${dimension.averageStance.toFixed(2)}"
                  ></div>
                </div>
                <div class="scale-labels">
                  <span>Negative</span>
                  <span>Neutral</span>
                  <span>Positive</span>
                </div>
                <div class="stance-value">
                  Average: ${dimension.averageStance.toFixed(2)} | Consensus:
                  ${dimension.consensus} | Sample size: ${dimension.sampleSize}
                </div>
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  override render() {
    if (this.loading) {
      return html`<div class="loading">Loading stance analysis...</div>`;
    }

    if (this.error) {
      return html`<div class="error">Error: ${this.error}</div>`;
    }

    if (this.pointId && this.stanceData) {
      return this.renderStanceVisualization();
    }

    if (this.postId && this.aggregateData) {
      return this.renderAggregateVisualization();
    }

    return html`<div class="error">No data to display</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "yp-stance-radar": YpStanceRadar;
  }
}
