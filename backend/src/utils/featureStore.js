/**
 * Feature Store — formalized feature registry for phishing detection.
 * Documents every feature used in training and inference with metadata.
 * Provides retrieval layer for consistent feature computation.
 */

// Feature specification registry
export const FEATURE_SPECS = [
  { id: 'url_length', name: 'URL Length', type: 'numeric', source: 'heuristic', category: 'structural' },
  { id: 'domain_length', name: 'Domain Length', type: 'numeric', source: 'heuristic', category: 'domain' },
  { id: 'path_length', name: 'Path Length', type: 'numeric', source: 'heuristic', category: 'structural' },
  { id: 'query_length', name: 'Query Length', type: 'numeric', source: 'heuristic', category: 'structural' },
  { id: 'subdomain_count', name: 'Subdomain Count', type: 'numeric', source: 'heuristic', category: 'domain' },
  { id: 'special_char_count', name: 'Special Character Count', type: 'numeric', source: 'heuristic', category: 'character' },
  { id: 'digit_count', name: 'Digit Count', type: 'numeric', source: 'heuristic', category: 'character' },
  { id: 'letter_count', name: 'Letter Count', type: 'numeric', source: 'heuristic', category: 'character' },
  { id: 'uppercase_count', name: 'Uppercase Count', type: 'numeric', source: 'heuristic', category: 'character' },
  { id: 'has_https', name: 'Has HTTPS', type: 'binary', source: 'heuristic', category: 'protocol' },
  { id: 'has_ip', name: 'Has IP Address', type: 'binary', source: 'heuristic', category: 'domain' },
  { id: 'has_port', name: 'Has Port Number', type: 'binary', source: 'heuristic', category: 'protocol' },
  { id: 'path_depth', name: 'Path Depth', type: 'numeric', source: 'heuristic', category: 'structural' },
  { id: 'slash_count', name: 'Slash Count', type: 'numeric', source: 'heuristic', category: 'character' },
  { id: 'hyphen_count', name: 'Hyphen Count', type: 'numeric', source: 'heuristic', category: 'character' },
  { id: 'underline_count', name: 'Underline Count', type: 'numeric', source: 'heuristic', category: 'character' },
  { id: 'question_mark_count', name: 'Question Mark Count', type: 'numeric', source: 'heuristic', category: 'character' },
  { id: 'encoded_char_count', name: 'Encoded Character Count', type: 'numeric', source: 'heuristic', category: 'character' },
  { id: 'at_symbol', name: '@ Symbol Present', type: 'binary', source: 'heuristic', category: 'structural' },
  { id: 'double_slash', name: 'Double Slash in Path', type: 'binary', source: 'heuristic', category: 'structural' },
  { id: 'suspicious_keyword_count', name: 'Suspicious Keyword Count', type: 'numeric', source: 'heuristic', category: 'content' },
  { id: 'entropy', name: 'Domain Shannon Entropy', type: 'numeric', source: 'heuristic', category: 'domain' },
  { id: 'is_suspicious_tld', name: 'Suspicious TLD', type: 'binary', source: 'heuristic', category: 'domain' },
  { id: 'is_legitimate_tld', name: 'Legitimate TLD', type: 'binary', source: 'heuristic', category: 'domain' },
  { id: 'url_long', name: 'URL > 75 chars', type: 'binary', source: 'heuristic', category: 'derived' },
  { id: 'domain_long', name: 'Domain > 20 chars', type: 'binary', source: 'heuristic', category: 'derived' },
  { id: 'path_long', name: 'Path > 50 chars', type: 'binary', source: 'heuristic', category: 'derived' },
  { id: 'many_subdomains', name: 'Subdomains > 2', type: 'binary', source: 'heuristic', category: 'derived' },
  { id: 'many_special_chars', name: 'Special Chars > 3', type: 'binary', source: 'heuristic', category: 'derived' },
  { id: 'many_digits', name: 'Digits > 5', type: 'binary', source: 'heuristic', category: 'derived' },
  { id: 'high_entropy', name: 'Entropy > 4.0', type: 'binary', source: 'heuristic', category: 'derived' },
  { id: 'bow_vector', name: 'Bag-of-Words (392K dims)', type: 'sparse', source: 'ml', category: 'text', dims: 392659 },
];

export function getFeatureById(id) {
  return FEATURE_SPECS.find(f => f.id === id) || null;
}

export function getFeaturesBySource(source) {
  return FEATURE_SPECS.filter(f => f.source === source);
}

export function getFeaturesByCategory(category) {
  return FEATURE_SPECS.filter(f => f.category === category);
}

export function getFeatureSummary() {
  return {
    total: FEATURE_SPECS.length,
    bySource: {
      heuristic: FEATURE_SPECS.filter(f => f.source === 'heuristic').length,
      ml: FEATURE_SPECS.filter(f => f.source === 'ml').length,
    },
    byCategory: {
      structural: FEATURE_SPECS.filter(f => f.category === 'structural').length,
      domain: FEATURE_SPECS.filter(f => f.category === 'domain').length,
      character: FEATURE_SPECS.filter(f => f.category === 'character').length,
      protocol: FEATURE_SPECS.filter(f => f.category === 'protocol').length,
      content: FEATURE_SPECS.filter(f => f.category === 'content').length,
      derived: FEATURE_SPECS.filter(f => f.category === 'derived').length,
      text: FEATURE_SPECS.filter(f => f.category === 'text').length,
    },
  };
}

export default {
  FEATURE_SPECS,
  getFeatureById,
  getFeaturesBySource,
  getFeaturesByCategory,
  getFeatureSummary,
};
