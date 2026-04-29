import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { ApiHealth, DashboardSettings } from '../types';

const Settings: React.FC = () => {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Settings state
  const [theme, setTheme] = useState<DashboardSettings['theme']>('system');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [notifications, setNotifications] = useState({
    blockedThreats: true,
    falsePositives: true,
    modelUpdates: false,
    systemAlerts: true,
  });

  // ML Model state
  const [recalibrating, setRecalibrating] = useState(false);
  const [retraining, setRetraining] = useState(false);

  // Data management state
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    checkHealth();
    // Load saved settings from localStorage
    const saved = localStorage.getItem('ngips-dashboard-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.autoRefresh !== undefined) setAutoRefresh(parsed.autoRefresh);
        if (parsed.refreshInterval) setRefreshInterval(parsed.refreshInterval);
        if (parsed.notifications) setNotifications(parsed.notifications);
      } catch { /* ignore */ }
    }
  }, []);

  function saveSettings() {
    const settings = { theme, autoRefresh, refreshInterval, notifications };
    localStorage.setItem('ngips-dashboard-settings', JSON.stringify(settings));
  }

  useEffect(() => {
    saveSettings();
  }, [theme, autoRefresh, refreshInterval, notifications]);

  async function checkHealth() {
    try {
      setCheckingHealth(true);
      const data = await apiService.getHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setCheckingHealth(false);
    }
  }

  async function handleRecalibrate() {
    setRecalibrating(true);
    try {
      await apiService.post('/v1/admin/calibrate');
      alert('Baseline calibrated');
    } catch (error) {
      console.error('Calibration failed:', error);
      alert('Calibration failed');
    } finally {
      setRecalibrating(false);
    }
  }

  async function handleRetrain() {
    if (!window.confirm('Trigger model retraining?')) return;
    setRetraining(true);
    try {
      await apiService.post('/v1/admin/retrain');
      alert('Retraining started');
    } catch (error) {
      console.error('Retraining failed:', error);
      alert('Retraining failed');
    } finally {
      setRetraining(false);
    }
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const data = await apiService.getScans({ limit: 1000 });
      const headers = ['ID', 'URL', 'Action', 'Threat Level', 'Confidence', 'Model', 'Time'];
      const rows = data.data.map((s) => [
        s.id,
        s.url,
        s.action,
        s.threatLevel,
        (s.confidence * 100).toFixed(1) + '%',
        s.modelVersion,
        s.timestamp,
      ]);
      const csv = [
        headers.join(','),
        ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phishing-data-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  async function handleClearHistory() {
    if (!window.confirm('Are you sure you want to clear all scan history? This action cannot be undone.')) return;
    setClearing(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/v1/admin/clear-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        alert('History cleared successfully');
      } else {
        alert('Failed to clear history');
      }
    } catch (error) {
      console.error('Clear history failed:', error);
      alert('Failed to clear history');
    } finally {
      setClearing(false);
    }
  }

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: 'light_mode' },
    { value: 'dark' as const, label: 'Dark', icon: 'dark_mode' },
    { value: 'system' as const, label: 'System', icon: 'contrast' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure your phishing detection dashboard preferences
        </p>
      </div>

      {/* Theme Selection */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <span className="material-symbols-outlined text-primary-600">palette</span>
            Theme
          </h2>
        </div>
        <div className="p-6">
          <div className="flex gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 p-3 transition-all ${
                  theme === option.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                }`}
              >
                <span className="material-symbols-outlined">{option.icon}</span>
                <span className="text-sm font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Health Status */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <span className="material-symbols-outlined text-primary-600">api</span>
            API Health
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={checkHealth}
              disabled={checkingHealth}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              {checkingHealth ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              ) : (
                <span className="material-symbols-outlined text-base">health_and_safety</span>
              )}
              Check Health
            </button>
          </div>
          {health && (
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">API Status</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{health.service} v{health.version}</p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  health.status === 'healthy'
                    ? 'bg-safe-100 text-safe-800 dark:bg-safe-900/30 dark:text-safe-400'
                    : 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400'
                }`}>
                  <span className="material-symbols-outlined text-xs">
                    {health.status === 'healthy' ? 'check_circle' : 'warning'}
                  </span>
                  {health.status}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Auto Refresh */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <span className="material-symbols-outlined text-primary-600">refresh</span>
            Auto Refresh
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Enable Auto Refresh</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Automatically refresh dashboard data</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700 dark:after:border-gray-600 dark:after:bg-gray-400" />
            </label>
          </div>
          {autoRefresh && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Refresh Interval: {refreshInterval}s
              </label>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="w-full accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>5s</span>
                <span>120s</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ML Model Controls */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <span className="material-symbols-outlined text-primary-600">smart_toy</span>
            ML Model Controls
          </h2>
        </div>
        <div className="p-6 space-y-4">
          {health?.models && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{health.models.status}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Version</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{health.models.version}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Method</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{health.models.method}</p>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleRecalibrate}
              disabled={recalibrating}
              className="inline-flex items-center gap-2 rounded-lg bg-warning-600 px-4 py-2 text-sm font-medium text-white hover:bg-warning-700 disabled:opacity-50"
            >
              {recalibrating ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span className="material-symbols-outlined text-base">tune</span>
              )}
              {recalibrating ? 'Recalibrating...' : 'Recalibrate'}
            </button>
            <button
              onClick={handleRetrain}
              disabled={retraining}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {retraining ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span className="material-symbols-outlined text-base">model_training</span>
              )}
              {retraining ? 'Triggering...' : 'Trigger Retraining'}
            </button>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <span className="material-symbols-outlined text-primary-600">database</span>
            Data Management
          </h2>
        </div>
        <div className="p-6 flex gap-3">
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            {exporting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            ) : (
              <span className="material-symbols-outlined text-base">download</span>
            )}
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            onClick={handleClearHistory}
            disabled={clearing}
            className="inline-flex items-center gap-2 rounded-lg border border-danger-300 bg-white px-4 py-2 text-sm font-medium text-danger-700 hover:bg-danger-50 disabled:opacity-50 dark:border-danger-700 dark:bg-gray-800 dark:text-danger-400"
          >
            {clearing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-danger-400 border-t-transparent" />
            ) : (
              <span className="material-symbols-outlined text-base">delete_forever</span>
            )}
            {clearing ? 'Clearing...' : 'Clear History'}
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <span className="material-symbols-outlined text-primary-600">notifications</span>
            Alert Notifications
          </h2>
        </div>
        <div className="p-6 space-y-4">
          {(
            [
              { key: 'blockedThreats', label: 'Blocked Threats', desc: 'Get notified when a phishing URL is blocked', icon: 'block' },
              { key: 'falsePositives', label: 'False Positives', desc: 'Get notified when a user reports a false positive', icon: 'report' },
              { key: 'modelUpdates', label: 'Model Updates', desc: 'Get notified when ML models are updated', icon: 'model_training' },
              { key: 'systemAlerts', label: 'System Alerts', desc: 'Get notified about system health issues', icon: 'warning' },
            ] as const
          ).map((item) => (
            <label key={item.key} className="flex cursor-pointer items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-gray-400">{item.icon}</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{item.label}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifications[item.key]}
                onChange={(e) => setNotifications((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Settings;
