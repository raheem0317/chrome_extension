import { FIELD_CATEGORIES } from '../shared/constants.js';

/**
 * Field Analyzer - Extracts semantic meaning from fields
 */
class FieldAnalyzer {
  constructor() {
    this.patterns = this.initializePatterns();
  }

  /**
   * Initialize field type patterns
   */
  initializePatterns() {
    return {
      [FIELD_CATEGORIES.FIRST_NAME]: [
        /first.*name/i,
        /fname/i,
        /given.*name/i,
        /forename/i
      ],
      [FIELD_CATEGORIES.LAST_NAME]: [
        /last.*name/i,
        /lname/i,
        /surname/i,
        /family.*name/i
      ],
      [FIELD_CATEGORIES.EMAIL]: [
        /email/i,
        /e.?mail/i,
        /mail/i
      ],
      [FIELD_CATEGORIES.PHONE]: [
        /phone/i,
        /telephone/i,
        /tel/i,
        /mobile/i,
        /cell/i
      ],
      [FIELD_CATEGORIES.ADDRESS]: [
        /address/i,
        /street/i,
        /addr/i
      ],
      [FIELD_CATEGORIES.CITY]: [
        /city/i,
        /town/i
      ],
      [FIELD_CATEGORIES.STATE]: [
        /state/i,
        /province/i,
        /region/i
      ],
      [FIELD_CATEGORIES.ZIP_CODE]: [
        /zip/i,
        /postal/i,
        /postcode/i
      ],
      [FIELD_CATEGORIES.COUNTRY]: [
        /country/i,
        /nation/i
      ],
      [FIELD_CATEGORIES.COMPANY]: [
        /company/i,
        /organization/i,
        /employer/i,
        /business/i
      ],
      [FIELD_CATEGORIES.JOB_TITLE]: [
        /job.*title/i,
        /position/i,
        /role/i,
        /occupation/i
      ],
      [FIELD_CATEGORIES.WEBSITE]: [
        /website/i,
        /url/i,
        /site/i
      ],
      [FIELD_CATEGORIES.NOTES]: [
        /note/i,
        /comment/i,
        /message/i,
        /additional/i
      ]
    };
  }

  /**
   * Analyze field metadata and determine category
   */
  analyzeField(field) {
    const scores = {};
    
    // Score based on various attributes
    this.scoreByAttribute(field, 'name', scores);
    this.scoreByAttribute(field, 'idAttr', scores);
    this.scoreByAttribute(field, 'label', scores);
    this.scoreByAttribute(field, 'placeholder', scores);
    this.scoreByType(field, scores);

    // Get highest scoring category
    const bestMatch = this.getBestMatch(scores);
    
    return {
      ...field,
      category: bestMatch,
      confidence: scores[bestMatch] || 0
    };
  }

  /**
   * Score field by text attribute
   */
  scoreByAttribute(field, attribute, scores) {
    const text = field[attribute] || '';
    
    for (const [category, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          scores[category] = (scores[category] || 0) + 1;
        }
      }
    }
  }

  /**
   * Score field by HTML type
   */
  scoreByType(field, scores) {
    const type = field.type?.toLowerCase() || '';
    
    if (type === 'email') {
      scores[FIELD_CATEGORIES.EMAIL] = (scores[FIELD_CATEGORIES.EMAIL] || 0) + 2;
    }
    if (type === 'tel') {
      scores[FIELD_CATEGORIES.PHONE] = (scores[FIELD_CATEGORIES.PHONE] || 0) + 2;
    }
    if (type === 'url') {
      scores[FIELD_CATEGORIES.WEBSITE] = (scores[FIELD_CATEGORIES.WEBSITE] || 0) + 2;
    }
  }

  /**
   * Get best matching category
   */
  getBestMatch(scores) {
    let bestCategory = null;
    let bestScore = 0;

    for (const [category, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  /**
   * Analyze multiple fields
   */
  analyzeFields(fields) {
    return fields.map(field => this.analyzeField(field));
  }

  /**
   * Get field context (surrounding text)
   */
  getFieldContext(element) {
    const context = {
      preceding: [],
      following: [],
      siblings: []
    };

    // Get preceding siblings
    let sibling = element.previousElementSibling;
    let count = 0;
    while (sibling && count < 3) {
      if (sibling.textContent && sibling.textContent.trim().length > 0) {
        context.preceding.push(sibling.textContent.trim());
        count++;
      }
      sibling = sibling.previousElementSibling;
    }

    // Get following siblings
    sibling = element.nextElementSibling;
    count = 0;
    while (sibling && count < 3) {
      if (sibling.textContent && sibling.textContent.trim().length > 0) {
        context.following.push(sibling.textContent.trim());
        count++;
      }
      sibling = sibling.nextElementSibling;
    }

    // Get parent context
    const parent = element.parentElement;
    if (parent) {
      const parentText = parent.textContent?.trim() || '';
      if (parentText.length > 0 && parentText.length < 200) {
        context.parent = parentText;
      }
    }

    return context;
  }

  /**
   * Extract semantic meaning from context
   */
  extractMeaningFromContext(context) {
    const allText = [
      ...context.preceding,
      ...context.following,
      context.parent
    ].filter(Boolean).join(' ').toLowerCase();

    const meaning = {};
    
    for (const [category, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(allText)) {
          meaning[category] = true;
          break;
        }
      }
    }

    return meaning;
  }

  /**
   * Combine field analysis with context
   */
  analyzeWithContext(field, element) {
    const basicAnalysis = this.analyzeField(field);
    const context = this.getFieldContext(element);
    const contextMeaning = this.extractMeaningFromContext(context);

    // Boost scores based on context
    const boostedScores = {};
    for (const category of Object.keys(FIELD_CATEGORIES)) {
      const baseScore = basicAnalysis.category === category ? basicAnalysis.confidence : 0;
      const contextBoost = contextMeaning[category] ? 1 : 0;
      boostedScores[category] = baseScore + contextBoost;
    }

    // Recalculate best match
    let bestCategory = basicAnalysis.category;
    let bestScore = boostedScores[basicAnalysis.category] || 0;

    for (const [category, score] of Object.entries(boostedScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return {
      ...basicAnalysis,
      category: bestCategory,
      confidence: bestScore,
      context
    };
  }
}

export default FieldAnalyzer;
