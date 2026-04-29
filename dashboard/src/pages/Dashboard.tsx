import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { DashboardStats, ScanRecord, ThreatClassification, ApiHealth } from '../types';
import { formatRelativeTime, formatNumber, getRiskColor, getRiskLabel } from '../utils';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [threats, setThreats] = useState<ThreatClassification[]>([]);
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [statsData, scansData, threatsData, healthData] = await Promise.all([
        apiService.getStatistics(),
        apiService.getScans({ limit: 10 }),
        apiService.getThreatClassification(),
        apiService.getHealth().catch(() => null),
      ]);
      setStats(statsData);
      setRecentScans(scansData.data);
      setThreats(threatsData);
      setHealth(healthData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data. Please check the API connection.');
    } finally {
      setLoading(false);
    }
  }

  const threatColors = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6'];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger-200 bg-danger-50 p-6 dark:border-danger-800 dark:bg-danger-900/20">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-danger-600">error</span>
          <div>
            <h3 className="font-semibold text-danger-800 dark:text-danger-300">Error Loading Dashboard</h3>
            <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="mt-4 rounded-lg bg-danger-600 px-4 py-2 text-sm text-white hover:bg-danger-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time phishing detection overview
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Scans */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Scans</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">
                {formatNumber(stats?.totalScans || 0)}
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="text-safe-600">+{stats?.recentScansLast24h || 0}</span> last 24h
              </p>
            </div>
            <div className="rounded-lg bg-primary-100 p-2 dark:bg-primary-900/30">
              <span className="material-symbols-outlined text-primary-600">dns</span>
            </div>
          </div>
        </div>

        {/* Blocked Threats */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Blocked Threats</p>
              <p className="mt-1 text-3xl font-bold text-danger-600">
                {formatNumber(stats?.blockedCount || 0)}
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                of {formatNumber(stats?.totalScans || 0)} total scans
              </p>
            </div>
            <div className="rounded-lg bg-danger-100 p-2 dark:bg-danger-900/30">
              <span className="material-symbols-outlined text-danger-600">block</span>
            </div>
          </div>
        </div>

        {/* Block Rate */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Block Rate</p>
              <p className="mt-1 text-3xl font-bold text-warning-600">
                {stats?.blockRate?.toFixed(1) || 0}%
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="text-safe-600">{stats?.avgConfidence ? `${(stats.avgConfidence * 100).toFixed(0)}%` : 'N/A'}</span> avg confidence
              </p>
            </div>
            <div className="rounded-lg bg-warning-100 p-2 dark:bg-warning-900/30">
              <span className="material-symbols-outlined text-warning-600">shield</span>
            </div>
          </div>
        </div>

        {/* ML Model Status */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">ML Model Status</p>
              <p className="mt-1 text-2xl font-bold text-safe-600">
                {health?.models?.status === 'loaded' ? 'Active' : 'Unknown'}
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                v{health?.models?.version || 'N/A'} • {health?.models?.method || 'unknown'}
              </p>
            </div>
            <div className="rounded-lg bg-safe-100 p-2 dark:bg-safe-900/30">
              <span className="material-symbols-outlined text-safe-600">model_training</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Security Events */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <span className="material-symbols-outlined text-primary-600">history</span>
              Recent Security Events
            </h2>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Last 10 scans
            </span>
          </div>
          <div className="overflow-x-auto">
            {recentScans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600">shield</span>
                <p className="mt-4 text-gray-500 dark:text-gray-400">No scans yet. Start by analyzing a URL.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 pb-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">URL</th>
                    <th className="px-6 pb-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Action</th>
                    <th className="px-6 pb-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Threat Level</th>
                    <th className="px-6 pb-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Confidence</th>
                    <th className="px-6 pb-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {recentScans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-base text-gray-400">language</span>
                          <span className="max-w-xs truncate font-mono text-sm text-gray-900 dark:text-gray-100">
                            {scan.url}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          scan.action === 'block'
                            ? 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400'
                            : 'bg-safe-100 text-safe-800 dark:bg-safe-900/30 dark:text-safe-400'
                        }`}>
                          <span className="material-symbols-outlined text-xs">
                            {scan.action === 'block' ? 'block' : 'check_circle'}
                          </span>
                          {scan.action === 'block' ? 'Blocked' : 'Allowed'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getRiskColor(scan.threatLevel)}`}>
                          {getRiskLabel(scan.threatLevel)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {(scan.confidence * 100).toFixed(0)}%
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(scan.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Threat Distribution */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <span className="material-symbols-outlined text-danger-600">donut_large</span>
                Threat Distribution
              </h2>
            </div>
            <div className="p-6">
              {threats.length > 0 ? (
                <div className="space-y-3">
                  {threats.map((threat, i) => (
                    <div key={threat.type}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">{threat.type}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{threat.percentage}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${threat.percentage}%`,
                            backgroundColor: threatColors[i % threatColors.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">Blocked</span>
                      <span className="font-medium text-gray-900 dark:text-white">{stats?.blockedCount || 0}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-danger-500"
                        style={{ width: `${stats?.blockRate || 0}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">Allowed</span>
                      <span className="font-medium text-gray-900 dark:text-white">{stats?.allowedCount || 0}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-safe-500"
                        style={{ width: `${100 - (stats?.blockRate || 0)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ML Model Insights */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <span className="material-symbols-outlined text-primary-600">psychology</span>
                ML Model Insights
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Model Version</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  v{health?.models?.version || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Detection Method</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {health?.models?.method || 'unknown'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Avg Confidence</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats?.avgConfidence ? `${(stats.avgConfidence * 100).toFixed(1)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">False Positive Rate</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats?.falsePositiveRate ? `${(stats.falsePositiveRate * 100).toFixed(2)}%` : 'N/A'}
                </span>
              </div>
              {health?.models?.available && health.models.available.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">Available Models</p>
                  <div className="flex flex-wrap gap-2">
                    {health.models.available.map((model) => (
                      <span key={model} className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-800 dark:bg-primary-900/30 dark:text-primary-400">
                        {model}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enterprise Shield Coverage */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <span className="material-symbols-outlined text-safe-600">verified_user</span>
                Enterprise Shield Coverage
              </h2>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-safe-50 p-3 dark:bg-safe-900/20">
                <span className="material-symbols-outlined text-safe-600">check_circle</span>
                <span className="text-sm text-safe-800 dark:text-safe-300">Real-time URL Analysis</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-safe-50 p-3 dark:bg-safe-900/20">
                <span className="material-symbols-outlined text-safe-600">check_circle</span>
                <span className="text-sm text-safe-800 dark:text-safe-300">ML-Powered Detection</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-safe-50 p-3 dark:bg-safe-900/20">
                <span className="material-symbols-outlined text-safe-600">check_circle</span>
                <span className="text-sm text-safe-800 dark:text-safe-300">Threat Intelligence Feed</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-safe-50 p-3 dark:bg-safe-900/20">
                <span className="material-symbols-outlined text-safe-600">check_circle</span>
                <span className="text-sm text-safe-800 dark:text-safe-300">Browser Extension Protection</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
