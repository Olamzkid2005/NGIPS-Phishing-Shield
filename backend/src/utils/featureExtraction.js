/**
 * URL Feature Extraction for Phishing Detection
 * Extracts structural, lexical, and heuristic features from URLs
 */

import { predictPhishing } from './mlInference.js';
import {
  URL_LENGTH_WARNING, DOMAIN_LENGTH_WARNING, PATH_LENGTH_WARNING,
  SUBDOMAIN_WARNING, SPECIAL_CHAR_WARNING, DIGIT_WARNING, ENTROPY_WARNING
} from './constants.js';

// Suspicious TLDs often used in phishing
const SUSPICIOUS_TLDS = new Set([
  'xyz', 'top', 'gq', 'tk', 'ml', 'cf', 'ga', 'click', 'link',
  'work', 'date', 'download', 'stream', 'win', 'review', 'country',
  'science', 'party', 'cricket', 'racing', 'accountant', 'loan'
]);

// Suspicious keywords in URLs
const SUSPICIOUS_KEYWORDS = new Set([
  'login', 'signin', 'account', 'verify', 'secure', 'update', 'confirm', 'banking',
  'password', 'credential', 'authenticate', 'mobile', 'wallet', 'payment',
  'invoice', 'support', 'customer', 'service', 'alert', 'urgent',
  'limited', 'expired', 'suspended', 'unusual', 'activity', 'security'
]);

// Legitimate TLDs
const LEGITIMATE_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'us', 'uk',
  'ca', 'au', 'de', 'fr', 'jp', 'cn'
]);

// Precompiled regex patterns for performance
const IP_PATTERN = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const SPECIAL_CHARS = new Set('!@#$%^&*()_+[]{}|;:\'",<>?/\\`~');

/**
 * Calculate Shannon entropy of a string
 */
function calculateEntropy(text) {
  if (!text) return 0;
  const counter = new Map();
  for (const char of text) {
    counter.set(char, (counter.get(char) || 0) + 1);
  }
  let entropy = 0;
  const length = text.length;
  for (const count of counter.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

/**
 * Extract domain info from URL
 */
function extractDomainInfo(url) {
  try {
    const parsed = new URL(url);

    const host = parsed.hostname.toLowerCase();

    // Check for IP address using precompiled pattern
    if (IP_PATTERN.test(host)) {
      return { domain: host, tld: 'ip', subdomainCount: 0, hasIp: true };
    }

    const parts = host.split('.');
    let tld = '';
    let domain = '';

    if (parts.length >= 2) {
      tld = parts[parts.length - 1];
      domain = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
    } else {
      domain = host;
    }

    const subdomainCount = Math.max(0, parts.length - 2);

    return {
      domain: host,
      tld,
      subdomainCount,
      hasIp: false,
      mainDomain: domain
    };
  } catch {
    return { domain: '', tld: '', subdomainCount: 0, hasIp: false };
  }
}

/**
 * Count character types in a URL
 */
function countCharacters(url) {
  let specialCharCount = 0;
  let digitCount = 0;
  let letterCount = 0;
  let uppercaseCount = 0;

  for (const char of url) {
    if (SPECIAL_CHARS.has(char)) specialCharCount++;
    if (/\d/.test(char)) digitCount++;
    if (/[a-z]/.test(char)) letterCount++;
    if (/[A-Z]/.test(char)) uppercaseCount++;
  }

  return { specialCharCount, digitCount, letterCount, uppercaseCount };
}

/**
 * Count URL patterns (slashes, hyphens, etc.)
 */
function countPatterns(url) {
  return {
    slashCount: (url.match(/\//g) || []).length,
    hyphenCount: (url.match(/-/g) || []).length,
    underlineCount: (url.match(/_/g) || []).length,
    questionMarkCount: (url.match(/\?/g) || []).length,
    encodedChars: (url.match(/%/g) || []).length
  };
}

/**
 * Detect suspicious keywords in URL
 */
function detectSuspiciousKeywords(url) {
  const found = [];
  const urlLower = url.toLowerCase();
  for (const kw of SUSPICIOUS_KEYWORDS) {
    if (urlLower.includes(kw)) found.push(kw);
  }
  return found;
}

/**
 * Extract all features from a URL
 */
function extractFeatures(url) {
  if (!url) return null;

  url = url.trim();

  // Try https first (more common for legitimate sites), fallback to http
  let normalizedUrl = url.startsWith('https://') || url.startsWith('http://')
    ? url
    : 'https://' + url;

  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    // Fallback to http if https fails
    normalizedUrl = url.startsWith('http://') ? url : 'http://' + url;
    try {
      parsed = new URL(normalizedUrl);
    } catch {
      return null;
    }
  }

  const domainInfo = extractDomainInfo(normalizedUrl);
  const charCounts = countCharacters(url);
  const { specialCharCount } = charCounts;
  const patterns = countPatterns(url);

  // Check for port
  const hasPort = /:\d+/.test(parsed.host);

  // Detect suspicious keywords
  const foundKeywords = detectSuspiciousKeywords(url);

  // Calculate entropy
  const entropy = calculateEntropy(parsed.hostname);

  // Path depth
  const pathDepth = parsed.pathname.split('/').filter(p => p).length;

  // Suspicious TLD
  const isSuspiciousTld = SUSPICIOUS_TLDS.has(domainInfo.tld);
  const isLegitimateTld = LEGITIMATE_TLDS.has(domainInfo.tld);

  return {
    url,
    urlLength: url.length,
    domainLength: parsed.hostname.length,
    pathLength: parsed.pathname.length,
    queryLength: parsed.search.length,
    subdomainCount: domainInfo.subdomainCount,
    ...charCounts,
    hasHttps: parsed.protocol === 'https:',
    tld: domainInfo.tld,
    hasIp: domainInfo.hasIp,
    hasPort,
    pathDepth,
    ...patterns,
    atSymbol: !!parsed.username,
    doubleSlash: parsed.pathname.includes('//'),
    suspiciousKeywords: foundKeywords,
    entropy,
    isSuspiciousTld,
    isLegitimateTld,

    // Derived features
    urlLong: url.length > URL_LENGTH_WARNING,
    domainLong: parsed.hostname.length > DOMAIN_LENGTH_WARNING,
    pathLong: parsed.pathname.length > PATH_LENGTH_WARNING,
    manySubdomains: domainInfo.subdomainCount > SUBDOMAIN_WARNING,
    manySpecialChars: specialCharCount > SPECIAL_CHAR_WARNING,
    manyDigits: digitCount > DIGIT_WARNING,
    highEntropy: entropy > ENTROPY_WARNING
  };
}

/**
 * Calculate phishing score based on features (0-1, higher = more suspicious)
 */
function calculatePhishingScore(features) {
  if (!features) return 0.5;
  
  let score = 0;
  let weights = 0;
  
  // IP address in URL (high risk)
  if (features.hasIp) {
    score += 0.8 * 0.3;
    weights += 0.3;
  }
  
  // Suspicious TLD
  if (features.isSuspiciousTld) {
    score += 0.7 * 0.25;
    weights += 0.25;
  }
  
  // Suspicious keywords
  if (features.suspiciousKeywords.length > 0) {
    const kwScore = Math.min(0.6, features.suspiciousKeywords.length * 0.15);
    score += kwScore * 0.2;
    weights += 0.2;
  }
  
  // Long URL
  if (features.urlLong) {
    score += 0.4 * 0.15;
    weights += 0.15;
  }
  
  // Many subdomains
  if (features.manySubdomains) {
    score += 0.5 * 0.1;
    weights += 0.1;
  }
  
  // High entropy (random-looking domain)
  if (features.highEntropy) {
    score += 0.6 * 0.1;
    weights += 0.1;
  }
  
  // @ symbol (possible credential theft)
  if (features.atSymbol) {
    score += 0.9 * 0.05;
    weights += 0.05;
  }
  
  // Encoded characters
  if (features.encodedChars > 2) {
    score += 0.5 * 0.05;
    weights += 0.05;
  }
  
  // Normalize score
  if (weights > 0) {
    return Math.min(0.99, score / weights);
  }
  
  // Default to low risk if no features matched
  return 0.15;
}

/**
 * Generate threat reasons based on features
 */
function generateReasons(features, score) {
  const reasons = [];
  
  if (!features) {
    reasons.push("Unable to analyze URL");
    return reasons;
  }
  
  if (features.hasIp) {
    reasons.push("Contains IP address instead of domain");
  }
  
  if (features.isSuspiciousTld) {
    reasons.push("Suspicious top-level domain");
  }
  
  if (features.suspiciousKeywords.length > 0) {
    reasons.push(`Contains suspicious keywords: ${features.suspiciousKeywords.join(', ')}`);
  }
  
  if (features.urlLong) {
    reasons.push("Unusually long URL");
  }
  
  if (features.manySubdomains) {
    reasons.push("Excessive subdomains detected");
  }
  
  if (features.highEntropy) {
    reasons.push("High domain entropy - unusual pattern");
  }
  
  if (features.atSymbol) {
    reasons.push("Contains @ symbol - possible credential theft");
  }
  
  if (score >= 0.8) {
    reasons.push("High ML model confidence for malicious pattern");
  } else if (score >= 0.6) {
    reasons.push("Moderate ML model confidence for suspicious pattern");
  } else if (reasons.length === 0) {
    reasons.push("No suspicious patterns detected");
  }
  
  return reasons;
}

/**
 * Main analysis function
 */
function analyzeUrl(url) {
  const startTime = Date.now();
  
  const features = extractFeatures(url);
  if (!features) {
    return {
      isValid: false,
      action: 'allow',
      confidence: 0,
      threatLevel: 'none',
      reasons: ['Invalid URL format'],
      processingTime: Date.now() - startTime
    };
  }
  
  const confidence = calculatePhishingScore(features);
  const reasons = generateReasons(features, confidence);
  
  // Determine threat level and action
  let threatLevel, action;
  if (confidence >= 0.8) {
    threatLevel = 'critical';
    action = 'block';
  } else if (confidence >= 0.6) {
    threatLevel = 'high';
    action = 'block';
  } else if (confidence >= 0.4) {
    threatLevel = 'medium';
    action = 'allow';
  } else {
    threatLevel = 'low';
    action = 'allow';
  }
  
  return {
    isValid: true,
    url,
    action,
    confidence: Math.round(confidence * 10000) / 10000,
    threatLevel,
    reasons,
    features,
    processingTime: Date.now() - startTime
  };
}

/**
 * Ensemble analysis combining heuristic and ML predictions
 * Uses 30% heuristic + 70% ML when ML is available, 100% heuristic otherwise
 */
async function analyzeUrlEnsemble(url) {
  const startTime = Date.now();

  // Run heuristic analysis
  const heuristicResult = analyzeUrl(url);

  if (!heuristicResult.isValid) {
    return {
      ...heuristicResult,
      heuristicConfidence: 0,
      mlConfidence: null,
      modelScores: null,
      mlAvailable: false
    };
  }

  // Run ML prediction
  const mlResult = await predictPhishing(url);

  let finalConfidence;
  let finalReasons;
  let mlConfidence = null;
  let modelScores = null;
  let mlAvailable = false;

  if (mlResult && mlResult.success && mlResult.data) {
    mlAvailable = true;
    mlConfidence = mlResult.data.ml_confidence;
    modelScores = mlResult.data.model_scores;

    // Ensemble: 30% heuristic + 70% ML
    finalConfidence = (heuristicResult.confidence * 0.3) + (mlResult.data.confidence * 0.7);

    // Combine reasons from both systems
    finalReasons = [...heuristicResult.reasons];

    // Add ML-specific reasons
    if (mlResult.data.is_phishing) {
      const confidencePct = Math.round(mlResult.data.confidence * 100);
      finalReasons.push(`ML model high confidence (${confidencePct}%)`);
    } else {
      const confidencePct = Math.round(mlResult.data.confidence * 100);
      finalReasons.push(`ML model indicates low risk (${confidencePct}%)`);
    }

    // Add individual model scores if divergent
    const lrScore = mlResult.data.model_scores?.logistic_regression;
    const mnbScore = mlResult.data.model_scores?.multinomial_nb;
    if (lrScore != null && mnbScore != null && Math.abs(lrScore - mnbScore) > 0.3) {
      finalReasons.push(`Model divergence: LR=${(lrScore * 100).toFixed(1)}% vs MNB=${(mnbScore * 100).toFixed(1)}%`);
    }
  } else {
    // ML unavailable or failed, use 100% heuristic
    if (mlResult && !mlResult.success) {
      console.warn(`[ML] Prediction failed: ${mlResult.error}`);
    }
    finalConfidence = heuristicResult.confidence;
    finalReasons = [...heuristicResult.reasons];
  }

  // Determine threat level and action based on ensemble score
  let threatLevel, action;
  if (finalConfidence >= 0.8) {
    threatLevel = 'critical';
    action = 'block';
  } else if (finalConfidence >= 0.6) {
    threatLevel = 'high';
    action = 'block';
  } else if (finalConfidence >= 0.4) {
    threatLevel = 'medium';
    action = 'allow';
  } else {
    threatLevel = 'low';
    action = 'allow';
  }

  return {
    isValid: true,
    url,
    action,
    confidence: Math.round(finalConfidence * 10000) / 10000,
    threatLevel,
    reasons: finalReasons,
    features: heuristicResult.features,
    heuristicConfidence: heuristicResult.confidence,
    mlConfidence,
    modelScores,
    mlAvailable,
    processingTime: Date.now() - startTime
  };
}

export { extractFeatures, calculatePhishingScore, generateReasons, analyzeUrl, analyzeUrlEnsemble };
export default { analyzeUrl, analyzeUrlEnsemble, extractFeatures, calculatePhishingScore };