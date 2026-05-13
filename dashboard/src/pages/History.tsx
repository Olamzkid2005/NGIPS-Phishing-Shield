import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '../services/api';
import type { ScanRecord, Action, Pagination } from '../types';
import { formatRelativeTime, getRiskColor, getRiskLabel } from '../utils';

const History: React.FC = () => {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<Action | 'all'>('all');
  const [urlSearch, setUrlSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const loadScans = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params: { page: number; limit: number; action?: Action; url_contains?: string } = {
        page,
        limit: 20,
      };
      if (actionFilter !== 'all') params.action = actionFilter;
      if (urlSearch.trim()) params.url_contains = urlSearch.trim();

      const data = await apiService.getScans(params);
      setScans(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load scans:', err);
      setError('Failed to load scan history');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, urlSearch]);

  useEffect(() => {
    loadScans(1);
  }, [loadScans]);

  function handlePageChange(page: number) {
    loadScans(page);
  }

  function handleExportCsv() {
    try {
      const headers = ['ID', 'URL', 'Action', 'Threat Level', 'Confidence', 'Model', 'Time'];
      const rows = scans.map((s) => [
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
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phishing-scan-history-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Export failed:', error);
      alert('Failed to export CSV');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scan History</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            View and manage all URL analysis results
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <span className="material-symbols-outlined text-base">download</span>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
            <input
              type="text"
              value={urlSearch}
              onChange={(e) => setUrlSearch(e.target.value)}
              placeholder="Search URLs..."
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            {urlSearch && (
              <button
                onClick={() => setUrlSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActionFilter('all')}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium ${
                actionFilter === 'all'
                  ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActionFilter('block')}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium ${
                actionFilter === 'block'
                  ? 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-base">block</span>
              Blocked
            </button>
            <button
              onClick={() => setActionFilter('allow')}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium ${
                actionFilter === 'allow'
                  ? 'bg-safe-100 text-safe-800 dark:bg-safe-900/30 dark:text-safe-400'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              Allowed
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            <span className="ml-3 text-gray-500 dark:text-gray-400">Loading scans...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-symbols-outlined text-5xl text-danger-400">error</span>
            <p className="mt-4 text-gray-500 dark:text-gray-400">{error}</p>
            <button onClick={() => loadScans(1)} className="mt-2 text-sm text-primary-600 hover:underline">Retry</button>
          </div>
        ) : scans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600">history</span>
            <p className="mt-4 text-gray-500 dark:text-gray-400">No scans found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">URL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Threat Level</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {scans.map((scan) => (
                  <React.Fragment key={scan.id}>
                    <tr
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      onClick={() => setExpandedRow(expandedRow === scan.id ? null : scan.id)}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">
                        {scan.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-base text-gray-400">language</span>
                          <span className="max-w-xs truncate font-mono text-sm text-gray-900 dark:text-gray-100">
                            {scan.url}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
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
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getRiskColor(scan.threatLevel)}`}>
                          {getRiskLabel(scan.threatLevel)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {(scan.confidence * 100).toFixed(0)}%
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {scan.modelVersion}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(scan.timestamp)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                          <span className="material-symbols-outlined text-base">
                            {expandedRow === scan.id ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {expandedRow === scan.id && (
                      <tr>
                        <td colSpan={8} className="bg-gray-50 px-6 py-4 dark:bg-gray-800/30">
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Full ID</p>
                              <p className="font-mono text-sm text-gray-900 dark:text-white">{scan.id}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Processing Time</p>
                              <p className="text-sm text-gray-900 dark:text-white">{scan.processingTime}ms</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Timestamp</p>
                              <p className="text-sm text-gray-900 dark:text-white">{new Date(scan.timestamp).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Confidence</p>
                              <div className="mt-1">
                                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                  <div
                                    className={`h-full rounded-full ${
                                      scan.confidence >= 0.8 ? 'bg-danger-500' : scan.confidence >= 0.6 ? 'bg-warning-500' : 'bg-safe-500'
                                    }`}
                                    style={{ width: `${scan.confidence * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          {scan.reasons && scan.reasons.length > 0 && (
                            <div className="mt-4">
                              <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Detection Reasons</p>
                              <div className="space-y-1">
                                {scan.reasons.map((reason, i) => (
                                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                    <span className="material-symbols-outlined text-xs text-danger-500">warning</span>
                                    {reason}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {scan.userFeedback && (
                            <div className="mt-4 rounded-lg bg-primary-50 p-3 dark:bg-primary-900/20">
                              <p className="text-xs font-medium text-primary-700 dark:text-primary-300">User Feedback</p>
                              <p className="text-sm text-primary-800 dark:text-primary-200">
                                {scan.userFeedback.isFalsePositive ? 'Reported as false positive' : 'Reported as false negative'}
                                {scan.userFeedback.comment && ` - ${scan.userFeedback.comment}`}
                              </p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium ${
                      pagination.page === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
