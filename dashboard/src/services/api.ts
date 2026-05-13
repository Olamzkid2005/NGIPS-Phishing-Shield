/**
 * API Service for NGIPS Phishing Shield Backend
 * Updated to match new backend API (http://localhost:8000)
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AnalysisResult,
  ApiHealth,
  AuthUser,
  FeedbackRequest,
  DashboardStats,
  LoginRequest,
  LoginResponse,
  ScanHistoryResponse,
  ScanRecord,
  AnalyticsTrends,
  TopDomain,
  ThreatClassification,
  FeedbackItem,
  FeedbackStatus,
  Settings,
  Pagination,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_VITE_API_BASE_URL || 'http://localhost:8000';

const getAuthToken = (): string | null => {
  try {
    const stored = localStorage.getItem('ngips-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.auth?.accessToken || null;
    }
  } catch { /* ignore */ }
  return null;
};

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        const token = getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        if (process.env.NODE_ENV === 'development') {
          console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (process.env.NODE_ENV === 'development') console.error('[API Error]', error.message);
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private handleError(error: AxiosError): Error {
    if (error.response) {
      const data = error.response.data as { error?: { code?: string; message?: string; details?: unknown[] } };
      const status = error.response.status;

      switch (status) {
        case 400:
          return new Error(data.error?.message || 'Invalid request');
        case 401:
          return new Error('Unauthorized - please login');
        case 403:
          return new Error('Forbidden - access denied');
        case 404:
          return new Error('Resource not found');
        case 422:
          return new Error(data.error?.message || 'Validation error');
        case 429:
          return new Error('Rate limit exceeded - please try later');
        case 500:
          return new Error('Internal server error');
        default:
          return new Error(data.error?.message || `Server error: ${status}`);
      }
    } else if (error.request) {
      return new Error('Network error - please check your connection');
    }
    return new Error(error.message || 'Unknown error');
  }

  async getHealth(): Promise<ApiHealth> {
    const response = await this.client.get<ApiHealth>('/health');
    return response.data;
  }

  async analyzeUrl(url: string): Promise<AnalysisResult> {
    const response = await this.client.post<AnalysisResult>('/v1/analyze', { url });
    return response.data;
  }

  async getScans(options: {
    page?: number;
    limit?: number;
    action?: 'allow' | 'block';
    url_contains?: string;
  } = {}): Promise<ScanHistoryResponse> {
    const { page = 1, limit = 50, action, url_contains } = options;
    
    const params: Record<string, string | number> = {
      page,
      limit: Math.min(limit, 100),
    };
    
    if (action) params.action = action;
    if (url_contains) params.url_contains = url_contains;

    const response = await this.client.get<ScanHistoryResponse>('/v1/scans', { params });
    return response.data;
  }

  async getScanById(scanId: string): Promise<ScanRecord> {
    const response = await this.client.get<ScanRecord>(`/v1/scans/${scanId}`);
    return response.data;
  }

  async submitFeedback(request: FeedbackRequest): Promise<void> {
    await this.client.post('/v1/feedback', request);
  }

  async getStatistics(): Promise<DashboardStats> {
    const response = await this.client.get<DashboardStats>('/v1/stats');
    return response.data;
  }

  async getAnalyticsTrends(period?: string): Promise<AnalyticsTrends> {
    const params: Record<string, string> = {};
    if (period) params.period = period;
    const response = await this.client.get<AnalyticsTrends>('/v1/analytics/trends', { params });
    return response.data;
  }

  async getTopDomains(): Promise<TopDomain[]> {
    const response = await this.client.get<{ domains: TopDomain[] }>('/v1/analytics/top-domains');
    return response.data.domains;
  }

  async getThreatClassification(): Promise<ThreatClassification[]> {
    const response = await this.client.get<{ classification: ThreatClassification[] }>('/v1/analytics/threats');
    return response.data.classification;
  }

  async getFeedback(
    page: number = 1,
    limit: number = 50,
    status?: string
  ): Promise<{ data: FeedbackItem[]; pagination: Pagination }> {
    const params: Record<string, string | number> = { page, limit: Math.min(limit, 100) };
    if (status && status !== 'all') params.status = status;
    const response = await this.client.get<{ data: FeedbackItem[]; pagination: Pagination }>(
      '/v1/feedback',
      { params }
    );
    return response.data;
  }

  async updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
    await this.client.patch(`/v1/feedback/${id}/status`, { status });
  }

  async getSettings(): Promise<Settings> {
    const response = await this.client.get<Settings>('/v1/settings');
    return response.data;
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    const response = await this.client.patch<Settings>('/v1/settings', settings);
    return response.data;
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/v1/auth/login', credentials);
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const response = await this.client.post<{ accessToken: string }>('/v1/auth/refresh', {
      refreshToken,
    });
    return response.data;
  }

  async logout(refreshToken?: string): Promise<void> {
    await this.client.post('/v1/auth/logout', { refreshToken });
  }

  async getCurrentUser(): Promise<AuthUser> {
    const response = await this.client.get<AuthUser>('/v1/auth/me');
    return response.data;
  }

  async post<T = unknown>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    const config: Record<string, unknown> = {};
    if (headers) config.headers = headers;
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async get<T = unknown>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;