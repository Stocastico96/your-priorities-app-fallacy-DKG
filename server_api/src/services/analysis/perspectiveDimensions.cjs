"use strict";

const models = require("../../models/index.cjs");
const log = require("../../utils/logger.cjs");

/**
 * Predefined dimension templates for common deliberation topics
 */
const DIMENSION_TEMPLATES = {
  "climate_policy": [
    {
      dimension_name: "economic_impact",
      dimension_description: "Economic costs and opportunities of the proposed policy",
      scale_negative_label: "High cost, negative economic impact",
      scale_positive_label: "Economic opportunity, positive ROI",
      position: 0
    },
    {
      dimension_name: "environmental_urgency",
      dimension_description: "Urgency of addressing environmental concerns",
      scale_negative_label: "Not urgent, can wait",
      scale_positive_label: "Critical, immediate action needed",
      position: 1
    },
    {
      dimension_name: "technological_feasibility",
      dimension_description: "Technical feasibility and readiness of solutions",
      scale_negative_label: "Not feasible with current technology",
      scale_positive_label: "Technologically achievable now",
      position: 2
    },
    {
      dimension_name: "social_equity",
      dimension_description: "Fair distribution of costs and benefits across society",
      scale_negative_label: "Unfair burden on certain groups",
      scale_positive_label: "Fair and equitable distribution",
      position: 3
    },
    {
      dimension_name: "international_cooperation",
      dimension_description: "Level of international coordination required",
      scale_negative_label: "Unilateral, national action",
      scale_positive_label: "Multilateral, global coordination",
      position: 4
    }
  ],
  "public_health": [
    {
      dimension_name: "public_safety",
      dimension_description: "Impact on public health and safety",
      scale_negative_label: "Minimal safety benefit",
      scale_positive_label: "Critical for public safety",
      position: 0
    },
    {
      dimension_name: "individual_freedom",
      dimension_description: "Impact on personal freedoms and choices",
      scale_negative_label: "Restricts individual freedom",
      scale_positive_label: "Preserves personal autonomy",
      position: 1
    },
    {
      dimension_name: "healthcare_access",
      dimension_description: "Accessibility and equity of healthcare services",
      scale_negative_label: "Limited access, inequitable",
      scale_positive_label: "Universal, equitable access",
      position: 2
    },
    {
      dimension_name: "cost_effectiveness",
      dimension_description: "Cost-benefit ratio of health interventions",
      scale_negative_label: "High cost, low benefit",
      scale_positive_label: "Cost-effective, high ROI",
      position: 3
    }
  ],
  "urban_development": [
    {
      dimension_name: "community_impact",
      dimension_description: "Effect on existing community and residents",
      scale_negative_label: "Disrupts community, displacement",
      scale_positive_label: "Strengthens community cohesion",
      position: 0
    },
    {
      dimension_name: "environmental_sustainability",
      dimension_description: "Environmental impact and sustainability",
      scale_negative_label: "Environmentally harmful",
      scale_positive_label: "Sustainable, eco-friendly",
      position: 1
    },
    {
      dimension_name: "economic_development",
      dimension_description: "Economic growth and job creation",
      scale_negative_label: "Minimal economic benefit",
      scale_positive_label: "Strong economic growth",
      position: 2
    },
    {
      dimension_name: "infrastructure_quality",
      dimension_description: "Quality of infrastructure and services",
      scale_negative_label: "Poor infrastructure, inadequate services",
      scale_positive_label: "High-quality, modern infrastructure",
      position: 3
    }
  ],
  "general": [
    {
      dimension_name: "feasibility",
      dimension_description: "Practical feasibility of implementation",
      scale_negative_label: "Not feasible, impractical",
      scale_positive_label: "Highly feasible, practical",
      position: 0
    },
    {
      dimension_name: "impact",
      dimension_description: "Expected positive impact and effectiveness",
      scale_negative_label: "Low impact, ineffective",
      scale_positive_label: "High impact, very effective",
      position: 1
    },
    {
      dimension_name: "fairness",
      dimension_description: "Fairness and equity of the proposal",
      scale_negative_label: "Unfair, inequitable",
      scale_positive_label: "Fair and equitable",
      position: 2
    },
    {
      dimension_name: "risk",
      dimension_description: "Risk level and potential downsides",
      scale_negative_label: "High risk, many downsides",
      scale_positive_label: "Low risk, minimal downsides",
      position: 3
    }
  ]
};

class PerspectiveDimensionsService {
  /**
   * Get available dimension templates
   */
  static getTemplates() {
    return DIMENSION_TEMPLATES;
  }

  /**
   * Create dimensions for a post or group using a template
   */
  static async createFromTemplate(templateName, postId = null, groupId = null) {
    try {
      const template = DIMENSION_TEMPLATES[templateName] || DIMENSION_TEMPLATES["general"];

      const dimensions = await Promise.all(
        template.map(dim =>
          models.DeliberationDimension.create({
            ...dim,
            post_id: postId,
            group_id: groupId,
            active: true
          })
        )
      );

      log.info("Created dimensions from template", {
        templateName,
        postId,
        groupId,
        count: dimensions.length
      });

      return dimensions;
    } catch (error) {
      log.error("Error creating dimensions from template", { error, templateName });
      throw error;
    }
  }

  /**
   * Get active dimensions for a post or group
   */
  static async getDimensions(postId = null, groupId = null) {
    try {
      const where = { active: true };

      if (postId) {
        where.post_id = postId;
      } else if (groupId) {
        where.group_id = groupId;
        where.post_id = null; // Only get group-level dimensions
      }

      const dimensions = await models.DeliberationDimension.findAll({
        where,
        order: [['position', 'ASC']]
      });

      return dimensions;
    } catch (error) {
      log.error("Error getting dimensions", { error, postId, groupId });
      throw error;
    }
  }

  /**
   * Create a custom dimension
   */
  static async createCustomDimension(dimensionData) {
    try {
      const dimension = await models.DeliberationDimension.create({
        ...dimensionData,
        active: true
      });

      log.info("Created custom dimension", { dimensionId: dimension.id });
      return dimension;
    } catch (error) {
      log.error("Error creating custom dimension", { error });
      throw error;
    }
  }

  /**
   * Update a dimension
   */
  static async updateDimension(dimensionId, updates) {
    try {
      const dimension = await models.DeliberationDimension.findByPk(dimensionId);

      if (!dimension) {
        throw new Error(`Dimension ${dimensionId} not found`);
      }

      await dimension.update(updates);
      log.info("Updated dimension", { dimensionId });

      return dimension;
    } catch (error) {
      log.error("Error updating dimension", { error, dimensionId });
      throw error;
    }
  }

  /**
   * Deactivate a dimension (soft delete)
   */
  static async deactivateDimension(dimensionId) {
    try {
      const dimension = await models.DeliberationDimension.findByPk(dimensionId);

      if (!dimension) {
        throw new Error(`Dimension ${dimensionId} not found`);
      }

      await dimension.update({ active: false });
      log.info("Deactivated dimension", { dimensionId });

      return dimension;
    } catch (error) {
      log.error("Error deactivating dimension", { error, dimensionId });
      throw error;
    }
  }

  /**
   * Get dimension by ID
   */
  static async getDimensionById(dimensionId) {
    try {
      const dimension = await models.DeliberationDimension.findByPk(dimensionId);
      return dimension;
    } catch (error) {
      log.error("Error getting dimension by ID", { error, dimensionId });
      throw error;
    }
  }
}

module.exports = PerspectiveDimensionsService;
