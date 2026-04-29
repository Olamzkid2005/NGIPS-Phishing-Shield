import { describe, it, expect } from 'vitest';
import { extractFeatures, calculatePhishingScore, analyzeUrl, generateReasons } from '../featureExtraction.js';

describe('Feature Extraction', () => {
  describe('extractFeatures', () => {
    it('should extract features from a valid URL', () => {
      const features = extractFeatures('http://example.com/path?q=test');
      expect(features).toBeTruthy();
      expect(features.urlLength).toBeGreaterThan(0);
      expect(features.hasHttps).toBe(false);
    });

    it('should detect HTTPS URLs', () => {
      const features = extractFeatures('https://example.com');
      expect(features.hasHttps).toBe(true);
    });

    it('should detect IP address URLs', () => {
      const features = extractFeatures('http://192.168.1.1/login');
      expect(features.hasIp).toBe(true);
    });

    it('should detect suspicious TLDs', () => {
      const features = extractFeatures('http://phishing.xyz/login');
      expect(features.isSuspiciousTld).toBe(true);
    });

    it('should detect legitimate TLDs', () => {
      const features = extractFeatures('https://example.com');
      expect(features.isLegitimateTld).toBe(true);
    });

    it('should detect suspicious keywords', () => {
      const features = extractFeatures('http://fake-login-verify.com/secure-account');
      expect(features.suspiciousKeywords.length).toBeGreaterThan(0);
    });

    it('should calculate entropy', () => {
      const features = extractFeatures('http://a8f9s7d6f8g9h0.com');
      expect(features.entropy).toBeGreaterThan(0);
    });

    it('should count subdomains', () => {
      const features = extractFeatures('http://a.b.c.example.com');
      expect(features.subdomainCount).toBeGreaterThan(2);
      expect(features.manySubdomains).toBe(true);
    });

    it('should detect @ symbol', () => {
      const features = extractFeatures('http://example.com@evil.com');
      expect(features.atSymbol).toBe(true);
    });

    it('should return null for empty string', () => {
      const features = extractFeatures('');
      expect(features).toBeNull();
    });

    it('should return null for invalid URLs', () => {
      const features = extractFeatures('not a valid url at all');
      expect(features).toBeNull();
    });

    it('should auto-prepend http:// for bare domains', () => {
      const features = extractFeatures('example.com');
      expect(features).toBeTruthy();
      expect(features.url).toBe('example.com');
      expect(features.hasHttps).toBe(false);
    });

    it('should derive boolean features correctly', () => {
      const longUrl = 'http://' + 'a'.repeat(80) + '.com/very/long/path/here';
      const features = extractFeatures(longUrl);
      expect(features.urlLong).toBe(true);
    });

    it('should count digits in URL', () => {
      const features = extractFeatures('http://123456.com');
      expect(features.digitCount).toBeGreaterThanOrEqual(6);
    });
  });

  describe('calculatePhishingScore', () => {
    it('should return higher score for suspicious features', () => {
      const suspiciousFeatures = extractFeatures('http://192.168.1.1/login-verify-account');
      const legitFeatures = extractFeatures('https://www.google.com/search');

      const suspiciousScore = calculatePhishingScore(suspiciousFeatures);
      const legitScore = calculatePhishingScore(legitFeatures);

      expect(suspiciousScore).toBeGreaterThan(legitScore);
    });

    it('should return 0.5 for null features', () => {
      expect(calculatePhishingScore(null)).toBe(0.5);
    });

    it('should return a score between 0 and 1', () => {
      const features = extractFeatures('https://example.com');
      const score = calculatePhishingScore(features);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should score IP-based URLs higher than domain-based', () => {
      const ipFeatures = extractFeatures('http://192.168.1.1/page');
      const domainFeatures = extractFeatures('http://example.com/page');

      expect(calculatePhishingScore(ipFeatures)).toBeGreaterThan(
        calculatePhishingScore(domainFeatures)
      );
    });

    it('should score suspicious TLD higher than legitimate TLD', () => {
      const suspiciousTld = extractFeatures('http://phishing.xyz/page');
      const legitTld = extractFeatures('http://example.com/page');

      expect(calculatePhishingScore(suspiciousTld)).toBeGreaterThan(
        calculatePhishingScore(legitTld)
      );
    });
  });

  describe('generateReasons', () => {
    it('should return reasons for IP address', () => {
      const features = extractFeatures('http://192.168.1.1/login');
      const reasons = generateReasons(features, 0.8);
      expect(reasons.some(r => r.includes('IP address'))).toBe(true);
    });

    it('should return reasons for suspicious keywords', () => {
      const features = extractFeatures('http://fake-login-verify.com');
      const reasons = generateReasons(features, 0.6);
      expect(reasons.some(r => r.includes('suspicious keywords'))).toBe(true);
    });

    it('should return "No suspicious patterns" for clean URL', () => {
      const features = extractFeatures('https://www.google.com');
      const reasons = generateReasons(features, 0.15);
      expect(reasons.some(r => r.includes('No suspicious patterns'))).toBe(true);
    });
  });

  describe('analyzeUrl', () => {
    it('should block high-confidence phishing URLs', () => {
      const result = analyzeUrl('http://192.168.1.1/paypal-login-verify-account');
      expect(result.action).toBe('block');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should allow legitimate URLs', () => {
      const result = analyzeUrl('https://www.google.com');
      expect(result.action).toBe('allow');
    });

    it('should include processing time', () => {
      const result = analyzeUrl('https://example.com');
      expect(result.processingTime).toBeDefined();
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should include threat level', () => {
      const result = analyzeUrl('https://example.com');
      expect(result.threatLevel).toBeDefined();
      expect(['none', 'low', 'medium', 'high', 'critical']).toContain(result.threatLevel);
    });

    it('should include reasons array', () => {
      const result = analyzeUrl('https://example.com');
      expect(Array.isArray(result.reasons)).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should mark invalid URLs as isValid false', () => {
      const result = analyzeUrl('');
      expect(result.isValid).toBe(false);
    });

    it('should return critical threat for highly suspicious URLs', () => {
      const result = analyzeUrl('http://192.168.1.1/paypal-login-verify-account');
      expect(['high', 'critical']).toContain(result.threatLevel);
    });
  });
});
