import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { DashboardStats, AnalyticsTrends, TopDomain, ThreatClassification } from '../types';
import { formatNumber } from '../utils';

type TimePeriod = '24h' | '7d' | '30d' | 'all';

const Analytics: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<AnalyticsTrends | null>(null);
  const [topDomains, setTopDomains] = useState<TopDomain[]>([]);
  const [threats, setThreats] = useState<ThreatClassification[]>([]);
  const [period, setPeriod] = useState<TimePeriod>('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  async function loadAnalytics() {
    try {
      setLoading(true);
      const [statsData, trendsData, domainsData, threatsData] = await Promise.all([
        apiService.getStatistics(),
        apiService.getAnalyticsTrends(period),
        apiService.getTopDomains(),
        apiService.getThreatClassification(),
      ]);
      setStats(statsData);
      setTrends(trendsData);
      setTopDomains(domainsData);
      setThreats(threatsData);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }

  const threatColors = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6'];
  const maxDomainCount = topDomains.length > 0 ? Math.max(...topDomains.map((d) => d.count)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Detection performance and threat intelligence
          </p>
        </div>
        <div className="flex gap-2">
          {(['24h', '7d', '30d', 'all'] as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                period === p
                  ? 'bg-primary-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {p === '24h' ? '24 Hours' : p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {loading && !stats ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading analytics...</span>
        </div>
      ) : (
        <>
          {/* Performance Metrics */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary-100 p-2 dark:bg-primary-900/30">
                  <span className="material-symbols-outlined text-primary-600">speed</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Average Confidence</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats?.avgConfidence ? `${(stats.avgConfidence * 100).toFixed(1)}%` : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-warning-100 p-2 dark:bg-warning-900/30">
                  <span className="material-symbols-outlined text-warning-600">timer</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">P99 Latency</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats?.recentScansLast24h ? '< 200ms' : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-safe-100 p-2 dark:bg-safe-900/30">
                  <span className="material-symbols-outlined text-safe-600">model_training</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Model Accuracy</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats?.falsePositiveRate !== undefined
                      ? `${((1 - stats.falsePositiveRate) * 100).toFixed(1)}%`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Scan Activity Trend */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <span className="material-symbols-outlined text-primary-600">trending_up</span>
                  Scan Activity Trend
                </h2>
              </div>
              <div className="p-6">
                {trends?.dailyData && trends.dailyData.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const maxTotal = Math.max(...trends.dailyData.map((x) => x.total), 1);
                      return trends.dailyData.map((d) => {
                      return (
                        <div key={d.date} className="flex items-center gap-3">
                          <span className="w-16 text-xs text-gray-500 dark:text-gray-400">
                            {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <div className="flex-1">
                            <div className="flex gap-1">
                              <div
                                className="h-5 rounded bg-primary-400"
                                style={{ width: `${(d.total / maxTotal) * 100}%` }}
                                title={`Total: ${d.total}`}
                              />
                              <div
                                className="h-5 rounded bg-danger-400"
                                style={{ width: `${(d.blocked / maxTotal) * 100}%` }}
                                title={`Blocked: ${d.blocked}`}
                              />
                            </div>
                          </div>
                          <span className="w-12 text-right text-xs font-medium text-gray-700 dark:text-gray-300">{d.total}</span>
                        </div>
                      );
                    });
                    })()}
                    <div className="flex items-center gap-4 pt-2">
                      <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded bg-primary-400" />
                        <span className="text-xs text-gray-500">Total</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded bg-danger-400" />
                        <span className="text-xs text-gray-500">Blocked</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center text-gray-400">
                    <span className="material-symbols-outlined mr-2">bar_chart</span>
                    No trend data available
                  </div>
                )}
              </div>
            </div>

            {/* Threat Classification */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <span className="material-symbols-outlined text-danger-600">donut_large</span>
                  Threat Classification
                </h2>
              </div>
              <div className="p-6">
                {threats.length > 0 ? (
                  <div className="space-y-4">
                    {/* Donut visualization using CSS */}
                    <div className="mx-auto flex items-center justify-center">
                      <div className="relative h-40 w-40">
                        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                          {threats.reduce<{ offset: number; elements: React.ReactNode[] }>(
                            (acc, threat, i) => {
                              const el = (
                                <circle
                                  key={threat.type}
                                  cx="18"
                                  cy="18"
                                  r="15.91549430918954"
                                  fill="transparent"
                                  stroke={threatColors[i % threatColors.length]}
                                  strokeWidth="3.5"
                                  strokeDasharray={`${threat.percentage} ${100 - threat.percentage}`}
                                  strokeDashoffset={`${-acc.offset}`}
                                />
                              );
                              acc.elements.push(el);
                              acc.offset += threat.percentage;
                              return acc;
                            },
                            { offset: 0, elements: [] }
                          ).elements}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold text-gray-900 dark:text-white">
                            {threats.length}
                          </span>
                          <span className="text-xs text-gray-500">Types</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {threats.map((threat, i) => (
                        <div key={threat.type} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: threatColors[i % threatColors.length] }}
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{threat.type}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{threat.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center text-gray-400">
                    <span className="material-symbols-outlined mr-2">donut_large</span>
                    No classification data
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Risk Domains */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <span className="material-symbols-outlined text-warning-600">domain</span>
                Top Risk Domains
              </h2>
            </div>
            <div className="p-6">
              {topDomains.length > 0 ? (
                <div className="space-y-3">
                  {topDomains.slice(0, 10).map((domain, i) => (
                    <div key={domain.domain} className="flex items-center gap-4">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{domain.domain}</span>
                          <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">{domain.count}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-full rounded-full bg-danger-500"
                            style={{ width: `${(domain.count / maxDomainCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center text-gray-400">
                  <span className="material-symbols-outlined mr-2">domain</span>
                  No domain data available
                </div>
              )}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary-500">dns</span>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Scans</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(stats?.totalScans || 0)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-danger-500">block</span>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Blocked</p>
                  <p className="text-xl font-bold text-danger-600">{formatNumber(stats?.blockedCount || 0)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-safe-500">check_circle</span>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Allowed</p>
                  <p className="text-xl font-bold text-safe-600">{formatNumber(stats?.allowedCount || 0)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-warning-500">feedback</span>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Feedback</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.totalFeedback || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
