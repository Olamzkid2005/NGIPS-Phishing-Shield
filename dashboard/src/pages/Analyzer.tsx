import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { AnalysisResult, ScanRecord, ThreatLevel } from '../types';
import { formatRelativeTime, getRiskColor, getRiskLabel, normalizeUrl } from '../utils';

const Analyzer: React.FC = () => {
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<ScanRecord[]>([]);
  const [showFeatures, setShowFeatures] = useState(false);

  useEffect(() => {
    loadRecent();
  }, []);

  async function loadRecent() {
    try {
      const data = await apiService.getScans({ limit: 5 });
      setRecentAnalyses(data.data);
    } catch {
      // Silent fail for sidebar
    }
  }

  async function handleAnalyze() {
    if (!url.trim()) {
      setError('Please enter a URL to analyze');
      return;
    }

    const normalized = normalizeUrl(url.trim());
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const data = await apiService.analyzeUrl(normalized);
      setResult(data);
      loadRecent();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
    } finally {
      setAnalyzing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleAnalyze();
    }
  }

  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return 'bg-danger-500';
    if (confidence >= 0.6) return 'bg-warning-500';
    if (confidence >= 0.4) return 'bg-primary-500';
    return 'bg-safe-500';
  }

  function getThreatLevelIcon(level: ThreatLevel): string {
    switch (level) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'check_circle';
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">URL Analyzer</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Analyze URLs for potential phishing threats using ML-powered detection
        </p>
      </div>

      {/* URL Input */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <label htmlFor="url-input" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Enter URL to analyze
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">link</span>
            <input
              id="url-input"
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com"
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {analyzing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="material-symbols-outlined text-base">search</span>
            )}
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
        {error && (
          <p className="mt-2 flex items-center gap-1 text-sm text-danger-600">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </p>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Action Badge & Confidence */}
          <div className={`rounded-xl border-2 p-6 ${
            result.action === 'block'
              ? 'border-danger-200 bg-danger-50/30 dark:border-danger-800 dark:bg-danger-900/10'
              : 'border-safe-200 bg-safe-50/30 dark:border-safe-800 dark:bg-safe-900/10'
          }`}>
            <div className="flex flex-col items-center text-center md:flex-row md:text-left">
              <div className={`mb-4 rounded-full p-4 md:mb-0 md:mr-6 ${
                result.action === 'block' ? 'bg-danger-100 dark:bg-danger-900/30' : 'bg-safe-100 dark:bg-safe-900/30'
              }`}>
                <span className={`material-symbols-outlined text-5xl ${
                  result.action === 'block' ? 'text-danger-600' : 'text-safe-600'
                }`}>
                  {result.action === 'block' ? 'gpp_bad' : 'verified_user'}
                </span>
              </div>
              <div className="flex-1">
                <h2 className={`text-2xl font-bold ${
                  result.action === 'block' ? 'text-danger-700 dark:text-danger-400' : 'text-safe-700 dark:text-safe-400'
                }`}>
                  {result.action === 'block' ? 'PHISHING DETECTED' : 'URL APPEARS SAFE'}
                </h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  {result.action === 'block'
                    ? 'This URL has been flagged as potentially malicious. Exercise caution.'
                    : 'No obvious phishing indicators were detected in this URL.'}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-6 md:justify-start">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Confidence</p>
                    <p className="text-2xl font-bold text-primary-600">
                      {(result.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="h-12 w-px bg-gray-300 dark:bg-gray-600" />
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Threat Level</p>
                    <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${getRiskColor(result.threatLevel)}`}>
                      <span className="material-symbols-outlined text-base">{getThreatLevelIcon(result.threatLevel)}</span>
                      {getRiskLabel(result.threatLevel)}
                    </span>
                  </div>
                  <div className="h-12 w-px bg-gray-300 dark:bg-gray-600" />
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Processing Time</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.processingTime}ms</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Confidence Bar */}
            <div className="mt-6">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Confidence Score</span>
                <span className="font-medium text-gray-900 dark:text-white">{(result.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getConfidenceColor(result.confidence)}`}
                  style={{ width: `${result.confidence * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Red Flags / Reasons */}
          {result.reasons && result.reasons.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <span className="material-symbols-outlined text-danger-600">flag</span>
                  Red Flags ({result.reasons.length})
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-2">
                  {result.reasons.map((reason, index) => (
                    <div key={index} className="flex items-start gap-3 rounded-lg bg-danger-50 p-3 dark:bg-danger-900/20">
                      <span className="material-symbols-outlined text-base text-danger-500 mt-0.5">warning</span>
                      <span className="text-sm text-danger-800 dark:text-danger-300">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Feature Analysis */}
          {result.features && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <button
                onClick={() => setShowFeatures(!showFeatures)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
              >
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <span className="material-symbols-outlined text-primary-600">analytics</span>
                  Feature Analysis
                </h2>
                <span className="material-symbols-outlined text-gray-400">
                  {showFeatures ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {showFeatures && (
                <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <FeatureCard label="URL Length" value={result.features.urlLength} icon="link" />
                    <FeatureCard label="Domain Length" value={result.features.domainLength} icon="language" />
                    <FeatureCard label="Path Length" value={result.features.pathLength} icon="route" />
                    <FeatureCard label="Subdomain Count" value={result.features.subdomainCount} icon="account_tree" />
                    <FeatureCard label="Digit Count" value={result.features.digitCount} icon="pin" />
                    <FeatureCard label="Special Chars" value={result.features.specialCharCount} icon="alternate_email" />
                    <FeatureCard label="Entropy" value={result.features.entropy.toFixed(2)} icon="speed" />
                    <FeatureCard label="Path Depth" value={result.features.pathDepth} icon="folder_open" />
                    <FeatureCard label="Hyphen Count" value={result.features.hyphenCount} icon="remove" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {result.features.hasHttps && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-safe-100 px-2.5 py-0.5 text-xs font-medium text-safe-800 dark:bg-safe-900/30 dark:text-safe-400">
                        <span className="material-symbols-outlined text-xs">lock</span> HTTPS
                      </span>
                    )}
                    {result.features.hasIp && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-danger-100 px-2.5 py-0.5 text-xs font-medium text-danger-800 dark:bg-danger-900/30 dark:text-danger-400">
                        <span className="material-symbols-outlined text-xs">warning</span> IP Address
                      </span>
                    )}
                    {result.features.isSuspiciousTld && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-2.5 py-0.5 text-xs font-medium text-warning-800 dark:bg-warning-900/30 dark:text-warning-400">
                        <span className="material-symbols-outlined text-xs">warning</span> Suspicious TLD
                      </span>
                    )}
                    {result.features.atSymbol && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-danger-100 px-2.5 py-0.5 text-xs font-medium text-danger-800 dark:bg-danger-900/30 dark:text-danger-400">
                        <span className="material-symbols-outlined text-xs">warning</span> @ Symbol
                      </span>
                    )}
                    {result.features.highEntropy && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-2.5 py-0.5 text-xs font-medium text-warning-800 dark:bg-warning-900/30 dark:text-warning-400">
                        <span className="material-symbols-outlined text-xs">warning</span> High Entropy
                      </span>
                    )}
                    {result.features.manySubdomains && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-2.5 py-0.5 text-xs font-medium text-warning-800 dark:bg-warning-900/30 dark:text-warning-400">
                        <span className="material-symbols-outlined text-xs">warning</span> Many Subdomains
                      </span>
                    )}
                  </div>
                  {result.features.suspiciousKeywords.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Suspicious Keywords</p>
                      <div className="flex flex-wrap gap-2">
                        {result.features.suspiciousKeywords.map((kw) => (
                          <span key={kw} className="rounded-full bg-danger-100 px-2.5 py-0.5 text-xs font-medium text-danger-800 dark:bg-danger-900/30 dark:text-danger-400">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Model Info */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-gray-400">smart_toy</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Model: {result.modelVersion}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">ID: {result.id}</p>
                </div>
              </div>
              <button
                onClick={() => { setResult(null); setUrl(''); }}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                Analyze Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!result && !analyzing && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600">shield</span>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Ready to Analyze</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Enter a URL above to check if it's a potential phishing threat
            </p>
          </div>
        </div>
      )}

      {/* Recent Analyses Sidebar */}
      {recentAnalyses.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <span className="material-symbols-outlined text-primary-600">history</span>
              Recent Analyses
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentAnalyses.map((scan) => (
              <div key={scan.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={`material-symbols-outlined text-base ${
                    scan.action === 'block' ? 'text-danger-500' : 'text-safe-500'
                  }`}>
                    {scan.action === 'block' ? 'block' : 'check_circle'}
                  </span>
                  <span className="truncate font-mono text-sm text-gray-900 dark:text-gray-100">{scan.url}</span>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getRiskColor(scan.threatLevel)}`}>
                    {getRiskLabel(scan.threatLevel)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(scan.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FeatureCard: React.FC<{ label: string; value: string | number; icon: string }> = ({ label, value, icon }) => (
  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-base text-gray-400">{icon}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    </div>
    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
  </div>
);

export default Analyzer;
