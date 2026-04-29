import React, { useEffect, useState, useMemo } from 'react';
import { apiService } from '../services/api';
import type { FeedbackItem, FeedbackStatus, Pagination } from '../types';

const Feedback: React.FC = () => {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitScanId, setSubmitScanId] = useState('');
  const [submitComment, setSubmitComment] = useState('');
  const [submitIsFalsePositive, setSubmitIsFalsePositive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFeedback();
  }, [statusFilter]);

  async function loadFeedback(page: number = 1) {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getFeedback(page, 20, statusFilter);
      setFeedback(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load feedback:', err);
      setError('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(id: string, status: FeedbackStatus) {
    try {
      await apiService.updateFeedbackStatus(id, status);
      setFeedback((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status } : item))
      );
      setSelectedFeedback(null);
    } catch (err) {
      console.error('Failed to update feedback status:', err);
    }
  }

  async function handleSubmitFeedback() {
    if (!submitScanId.trim()) return;
    try {
      setSubmitting(true);
      await apiService.submitFeedback({
        scanId: submitScanId,
        isFalsePositive: submitIsFalsePositive,
        userComment: submitComment || undefined,
      });
      setShowSubmitModal(false);
      setSubmitScanId('');
      setSubmitComment('');
      setSubmitIsFalsePositive(false);
      loadFeedback();
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredFeedback = useMemo(() => {
    if (statusFilter === 'all') return feedback;
    return feedback.filter((item) => item.status === statusFilter);
  }, [feedback, statusFilter]);

  const stats = useMemo(() => {
    const total = pagination.total;
    const pending = feedback.filter((f) => f.status === 'pending').length;
    const reviewed = feedback.filter((f) => f.status === 'reviewed').length;
    const actioned = feedback.filter((f) => f.status === 'actioned').length;
    const falsePositives = feedback.filter((f) => f.isFalsePositive).length;
    const accuracyRate = total > 0 ? ((total - falsePositives) / total) * 100 : 0;
    return { total, pending, reviewed, actioned, falsePositives, accuracyRate };
  }, [feedback, pagination.total]);

  function getStatusBadge(status: FeedbackStatus) {
    const config = {
      pending: { bg: 'bg-warning-100 dark:bg-warning-900/30', text: 'text-warning-800 dark:text-warning-400', icon: 'schedule' },
      reviewed: { bg: 'bg-primary-100 dark:bg-primary-900/30', text: 'text-primary-800 dark:text-primary-400', icon: 'visibility' },
      actioned: { bg: 'bg-safe-100 dark:bg-safe-900/30', text: 'text-safe-800 dark:text-safe-400', icon: 'check_circle' },
    };
    const c = config[status];
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
        <span className="material-symbols-outlined text-xs">{c.icon}</span>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  function getTypeBadge(isFalsePositive: boolean) {
    return isFalsePositive ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-safe-100 px-2.5 py-0.5 text-xs font-medium text-safe-800 dark:bg-safe-900/30 dark:text-safe-400">
        <span className="material-symbols-outlined text-xs">check_circle</span>
        False Positive
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-100 px-2.5 py-0.5 text-xs font-medium text-danger-800 dark:bg-danger-900/30 dark:text-danger-400">
        <span className="material-symbols-outlined text-xs">warning</span>
        Missed Detection
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feedback Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Review and manage user feedback submissions
          </p>
        </div>
        <button
          onClick={() => setShowSubmitModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Submit Feedback
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-100 p-2 dark:bg-primary-900/30">
              <span className="material-symbols-outlined text-primary-600">analytics</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Accuracy Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.accuracyRate.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Based on current page</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-danger-100 p-2 dark:bg-danger-900/30">
              <span className="material-symbols-outlined text-danger-600">report</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">False Positives</p>
              <p className="text-2xl font-bold text-danger-600">{stats.falsePositives}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">On current page</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-warning-100 p-2 dark:bg-warning-900/30">
              <span className="material-symbols-outlined text-warning-600">pending</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending Review</p>
              <p className="text-2xl font-bold text-warning-600">{stats.pending}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">On current page</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'reviewed', 'actioned'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              statusFilter === tab
                ? 'bg-primary-600 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'all' && ` (${stats.total})`}
            {tab === 'pending' && ` (${stats.pending})`}
            {tab === 'reviewed' && ` (${stats.reviewed})`}
            {tab === 'actioned' && ` (${stats.actioned})`}
          </button>
        ))}
      </div>

      {/* Feedback Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            <span className="ml-3 text-gray-500 dark:text-gray-400">Loading feedback...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-symbols-outlined text-5xl text-danger-400">error</span>
            <p className="mt-4 text-gray-500 dark:text-gray-400">{error}</p>
            <button onClick={() => loadFeedback()} className="mt-2 text-sm text-primary-600 hover:underline">Retry</button>
          </div>
        ) : filteredFeedback.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600">feedback</span>
            <p className="mt-4 text-gray-500 dark:text-gray-400">No feedback found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">URL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Comment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredFeedback.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-gray-500 dark:text-gray-400">
                      {item.id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs truncate">
                        <span className="font-mono text-sm text-gray-900 dark:text-white">{item.url || item.scanId || '—'}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{getTypeBadge(item.isFalsePositive)}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{item.userComment || '-'}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{getStatusBadge(item.status)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        onClick={() => setSelectedFeedback(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      >
                        <span className="material-symbols-outlined text-base">visibility</span>
                        Review
                      </button>
                    </td>
                  </tr>
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
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => loadFeedback(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) pageNum = i + 1;
                else if (pagination.page <= 3) pageNum = i + 1;
                else if (pagination.page >= pagination.totalPages - 2) pageNum = pagination.totalPages - 4 + i;
                else pageNum = pagination.page - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => loadFeedback(pageNum)}
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
                onClick={() => loadFeedback(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Review Feedback</h2>
              <button
                onClick={() => setSelectedFeedback(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">URL</p>
                <p className="font-mono text-sm break-all text-gray-900 dark:text-white">{selectedFeedback.url || selectedFeedback.scanId || '—'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
                <div className="mt-1">{getTypeBadge(selectedFeedback.isFalsePositive)}</div>
              </div>
              {selectedFeedback.userComment && (
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Comment</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedFeedback.userComment}</p>
                </div>
              )}
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Current Status</p>
                <div className="mt-1">{getStatusBadge(selectedFeedback.status)}</div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleUpdateStatus(selectedFeedback.id, 'reviewed')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-safe-600 px-4 py-2 text-sm font-medium text-white hover:bg-safe-700"
                >
                  <span className="material-symbols-outlined text-base">visibility</span>
                  Mark Reviewed
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedFeedback.id, 'actioned')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Mark Actioned
                </button>
              </div>
              <button
                onClick={() => setSelectedFeedback(null)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Feedback Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Submit Feedback</h2>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Scan ID</label>
                <input
                  type="text"
                  value={submitScanId}
                  onChange={(e) => setSubmitScanId(e.target.value)}
                  placeholder="Enter scan ID"
                  className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Feedback Type</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSubmitIsFalsePositive(true)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 p-3 transition-all ${
                      submitIsFalsePositive
                        ? 'border-safe-500 bg-safe-50 text-safe-700 dark:bg-safe-900/20'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <span className="material-symbols-outlined">check_circle</span>
                    <span className="text-sm font-medium">False Positive</span>
                  </button>
                  <button
                    onClick={() => setSubmitIsFalsePositive(false)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 p-3 transition-all ${
                      !submitIsFalsePositive
                        ? 'border-danger-500 bg-danger-50 text-danger-700 dark:bg-danger-900/20'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <span className="material-symbols-outlined">warning</span>
                    <span className="text-sm font-medium">Missed Detection</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Comment (optional)</label>
                <textarea
                  value={submitComment}
                  onChange={(e) => setSubmitComment(e.target.value)}
                  placeholder="Add details about this feedback..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <button
                onClick={handleSubmitFeedback}
                disabled={submitting || !submitScanId.trim()}
                className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feedback;
