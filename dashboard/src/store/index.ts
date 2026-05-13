/**
 * Zustand Store for NGIPS Phishing Shield
 * Updated for new backend API
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

let notificationTimer = null;
import type { 
  AnalysisResult, 
  ScanRecord, 
  ApiHealth, 
  DashboardStats,
  DashboardSettings,
  AnalyticsTrends,
  TopDomain,
  ThreatClassification,
  FeedbackItem,
  FeedbackStatus,
  Settings
} from '@/types';
import apiService from '@/services/api';

interface AppState {
  // UI State
  theme: 'light' | 'dark' | 'system';
  isLoading: boolean;
  error: string | null;
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;

  // Data State
  health: ApiHealth | null;
  currentAnalysis: AnalysisResult | null;
  scanHistory: ScanRecord[];
  dashboardStats: DashboardStats | null;
  scansPage: number;
  scansTotal: number;
  scansLoading: boolean;

  // Analytics State
  analyticsTrends: AnalyticsTrends | null;
  topDomains: TopDomain[];
  threatClassification: ThreatClassification[];
  analyticsLoading: boolean;

  // Feedback Management State
  feedbackList: FeedbackItem[];
  feedbackPage: number;
  feedbackTotal: number;
  feedbackLoading: boolean;

  // Settings State
  settings: Settings | null;
  settingsLoading: boolean;

  // Auth State
  auth: {
    user: { id: string; email: string; role: string } | null;
    accessToken: string | null;
    refreshToken: string | null;
  };

  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  clearNotification: () => void;

  // API Actions
  checkHealth: () => Promise<void>;
  analyzeUrl: (url: string) => Promise<AnalysisResult | null>;
  fetchScans: (page?: number, limit?: number) => Promise<void>;
  submitFeedback: (scanId: string, isFalsePositive: boolean, comment?: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  refreshDashboardStats: () => Promise<void>;

  // Analytics Actions
  fetchAnalyticsTrends: () => Promise<void>;
  fetchTopDomains: () => Promise<void>;
  fetchThreatClassification: () => Promise<void>;

  // Feedback Management Actions
  fetchFeedback: (page: number, limit?: number) => Promise<void>;
  updateFeedbackStatus: (id: string, status: FeedbackStatus) => Promise<void>;

  // Settings Actions
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;

  // Auth Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      theme: 'system',
      isLoading: false,
      error: null,
      notification: null,
      health: null,
      currentAnalysis: null,
      scanHistory: [],
      dashboardStats: null,
      scansPage: 1,
      scansTotal: 0,
      scansLoading: false,

      // Analytics Initial State
      analyticsTrends: null,
      topDomains: [],
      threatClassification: [],
      analyticsLoading: false,

      // Feedback Management Initial State
      feedbackList: [],
      feedbackPage: 1,
      feedbackTotal: 0,
      feedbackLoading: false,

      // Settings Initial State
      settings: null,
      settingsLoading: false,

      auth: {
        user: null,
        accessToken: null,
        refreshToken: null,
      },

      // UI Actions
      setTheme: (theme) => set({ theme }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error }),
      
      showNotification: (message, type) => {
        if (notificationTimer) clearTimeout(notificationTimer);
        set({ notification: { message, type } });
        notificationTimer = setTimeout(() => {
          get().clearNotification();
          notificationTimer = null;
        }, 5000);
      },
      
      clearNotification: () => set({ notification: null }),

      // API Actions
      checkHealth: async () => {
        try {
          const health = await apiService.getHealth();
          set({ health });
        } catch (error) {
          console.error('Health check failed:', error);
          set({ health: null });
        }
      },

      analyzeUrl: async (url: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await apiService.analyzeUrl(url);
          set({ currentAnalysis: result });
          
          // Add to scan history (newest first, keep last 100)
          const newScan: ScanRecord = {
            id: result.id,
            url: result.url,
            action: result.action,
            confidence: result.confidence,
            threatLevel: result.threatLevel,
            reasons: result.reasons,
            modelVersion: result.modelVersion,
            processingTime: result.processingTime,
            timestamp: result.timestamp,
          };
          
          set((state) => ({
            scanHistory: [newScan, ...state.scanHistory].slice(0, 100),
          }));
          
          // Refresh stats after analysis
          get().refreshDashboardStats();
          
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Analysis failed';
          set({ error: message });
          get().showNotification(message, 'error');
          return null;
        } finally {
          set({ isLoading: false });
        }
      },

      fetchScans: async (page = 1, limit = 50) => {
        set({ scansLoading: true });
        try {
          const response = await apiService.getScans({ page, limit });
          set({
            scanHistory: response.data,
            scansPage: response.pagination.page,
            scansTotal: response.pagination.total,
          });
        } catch (error) {
          console.error('Failed to fetch scans:', error);
          get().showNotification('Failed to load scan history', 'error');
        } finally {
          set({ scansLoading: false });
        }
      },

      submitFeedback: async (scanId: string, isFalsePositive: boolean, comment?: string) => {
        try {
          await apiService.submitFeedback({
            scanId,
            isFalsePositive,
            userComment: comment,
          });
          get().showNotification('Feedback submitted successfully', 'success');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to submit feedback';
          get().showNotification(message, 'error');
        }
      },

      clearHistory: async () => {
        try {
          await apiService.post('/v1/admin/clear-history');
          set({ scanHistory: [], scansTotal: 0 });
          get().showNotification('History cleared', 'success');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to clear history';
          get().showNotification(message, 'error');
        }
      },

      refreshDashboardStats: async () => {
        try {
          const stats = await apiService.getStatistics();
          set({ dashboardStats: stats });
        } catch (error) {
          console.error('Failed to refresh stats:', error);
        }
      },

      // Analytics Actions
      fetchAnalyticsTrends: async () => {
        set({ analyticsLoading: true });
        try {
          const trends = await apiService.getAnalyticsTrends();
          set({ analyticsTrends: trends });
        } catch (error) {
          console.error('Failed to fetch analytics trends:', error);
          get().showNotification('Failed to load analytics trends', 'error');
        } finally {
          set({ analyticsLoading: false });
        }
      },

      fetchTopDomains: async () => {
        try {
          const domains = await apiService.getTopDomains();
          set({ topDomains: domains });
        } catch (error) {
          console.error('Failed to fetch top domains:', error);
        }
      },

      fetchThreatClassification: async () => {
        try {
          const threats = await apiService.getThreatClassification();
          set({ threatClassification: threats });
        } catch (error) {
          console.error('Failed to fetch threat classification:', error);
        }
      },

      // Feedback Management Actions
      fetchFeedback: async (page: number, limit: number = 50) => {
        set({ feedbackLoading: true });
        try {
          const response = await apiService.getFeedback(page, limit);
          set({
            feedbackList: response.data,
            feedbackPage: response.pagination.page,
            feedbackTotal: response.pagination.total,
          });
        } catch (error) {
          console.error('Failed to fetch feedback:', error);
          get().showNotification('Failed to load feedback', 'error');
        } finally {
          set({ feedbackLoading: false });
        }
      },

      updateFeedbackStatus: async (id: string, status: FeedbackStatus) => {
        try {
          await apiService.updateFeedbackStatus(id, status);
          set((state) => ({
            feedbackList: state.feedbackList.map((item) =>
              item.id === id ? { ...item, status } : item
            ),
          }));
          get().showNotification('Feedback status updated', 'success');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update status';
          get().showNotification(message, 'error');
        }
      },

      // Settings Actions
      fetchSettings: async () => {
        set({ settingsLoading: true });
        try {
          const settings = await apiService.getSettings();
          set({ settings });
        } catch (error) {
          console.error('Failed to fetch settings:', error);
          get().showNotification('Failed to load settings', 'error');
        } finally {
          set({ settingsLoading: false });
        }
      },

      updateSettings: async (settings: Partial<Settings>) => {
        try {
          const updated = await apiService.updateSettings(settings);
          set({ settings: updated });
          get().showNotification('Settings updated successfully', 'success');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update settings';
          get().showNotification(message, 'error');
        }
      },

      // Auth Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.login({ email, password });
          set({
            auth: {
              user: response.user,
              accessToken: response.accessToken,
              refreshToken: response.refreshToken,
            },
          });
          get().showNotification('Login successful', 'success');
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({ error: message });
          get().showNotification(message, 'error');
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        const { auth } = get();
        if (auth?.refreshToken) {
          try {
            await apiService.logout(auth.refreshToken);
          } catch {
            // Ignore logout errors
          }
        }
        set({
          auth: { user: null, accessToken: null, refreshToken: null },
        });
        get().showNotification('Logged out', 'success');
      },

      checkAuth: async () => {
        const { auth } = get();
        if (!auth?.accessToken) return;
        
        try {
          const user = await apiService.getCurrentUser();
          set((state) => ({
            auth: { ...state.auth, user },
          }));
        } catch {
          // Token expired, clear auth
          set({
            auth: { user: null, accessToken: null, refreshToken: null },
          });
        }
      },
    }),
    {
      name: 'ngips-storage',
      partialize: (state) => ({
        theme: state.theme,
        auth: state.auth,
      }),
    }
  )
);

// Settings store (persistent)
interface SettingsState extends DashboardSettings {
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setApiBaseUrl: (url: string) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      apiBaseUrl: 'http://localhost:8000',
      autoRefresh: true,
      refreshInterval: 30,
      notificationsEnabled: true,

      setTheme: (theme) => set({ theme }),
      setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl }),
      setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
      setRefreshInterval: (refreshInterval) => set({ refreshInterval }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
    }),
    {
      name: 'ngips-settings',
    }
  )
);