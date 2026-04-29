// API Types for NGIPS Phishing Shield - Updated for new backend

// ============ Analysis Types ============

export interface AnalysisResult {
  id: string;
  url: string;
  action: 'allow' | 'block';
  confidence: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  modelVersion: string;
  processingTime: number;
  timestamp: string;
  features?: UrlFeatures;
}

export interface UrlFeatures {
  urlLength: number;
  domainLength: number;
  pathLength: number;
  queryLength: number;
  subdomainCount: number;
  specialCharCount: number;
  digitCount: number;
  letterCount: number;
  uppercaseCount: number;
  hasHttps: boolean;
  tld: string;
  hasIp: boolean;
  hasPort: boolean;
  pathDepth: number;
  slashCount: number;
  hyphenCount: number;
  underlineCount: number;
  questionMarkCount: number;
  atSymbol: boolean;
  doubleSlash: boolean;
  encodedChars: number;
  suspiciousKeywords: string[];
  entropy: number;
  isSuspiciousTld: boolean;
  isLegitimateTld: boolean;
  urlLong: boolean;
  domainLong: boolean;
  pathLong: boolean;
  manySubdomains: boolean;
  manySpecialChars: boolean;
  manyDigits: boolean;
  highEntropy: boolean;
}

// ============ Scan History Types ============

export interface ScanRecord {
  id: string;
  url: string;
  action: 'allow' | 'block';
  confidence: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  modelVersion: string;
  processingTime: number;
  timestamp: string;
  userFeedback?: UserFeedback;
}

export interface UserFeedback {
  isFalsePositive: boolean;
  comment?: string;
  submittedAt: string;
}

// ============ Statistics Types ============

export interface DashboardStats {
  totalScans: number;
  blockedCount: number;
  allowedCount: number;
  blockRate: number;
  threatLevelDistribution: { low: number; medium: number; high: number; critical: number };
  avgConfidence: number;
  recentScansLast24h: number;
  totalFeedback: number;
  falsePositiveReports: number;
  falsePositiveRate: number;
  mlModelStatus?: { status: string; version: string; available: string[] };
  latencyPercentiles?: { p50: number; p95: number; p99: number };
  driftStatus?: { drifted: boolean; psi: number };
  recentAlerts?: Array<{ type: string; message: string; timestamp: number }>;
  confidenceDistribution?: number[];
  timestamp?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ScanHistoryResponse {
  data: ScanRecord[];
  pagination: Pagination;
}

// ============ Analytics Types ============

export interface TrendDataPoint {
  date: string;
  total: number;
  blocked: number;
}

export interface AnalyticsTrends {
  dailyData: TrendDataPoint[];
  weeklyData: TrendDataPoint[];
}

export interface TopDomain {
  domain: string;
  count: number;
}

export interface ThreatClassification {
  type: string;
  percentage: number;
}

// ============ Health Check Types ============

export interface ApiHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  models: {
    status: 'loaded' | 'unavailable';
    method: string;
    version: string;
    available: string[];
    error: string | null;
  };
}

// ============ Authentication Types ============

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

// ============ Feedback Types ============

export type FeedbackStatus = 'pending' | 'reviewed' | 'actioned';

export interface FeedbackRequest {
  scanId: string;
  isFalsePositive?: boolean;
  userComment?: string;
}

export interface FeedbackItem {
  id: string;
  url: string;
  isFalsePositive: boolean;
  userComment: string | null;
  status: FeedbackStatus;
  timestamp: string;
}

export interface FeedbackResponse {
  id: string;
  scanId: string;
  isFalsePositive: boolean;
  userComment: string | null;
  status: FeedbackStatus;
  timestamp: string;
}

export interface FeedbackListResponse {
  data: FeedbackItem[];
  pagination: Pagination;
}

// ============ Error Types ============

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: ValidationError[];
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

// ============ Extension Types (for browser extension) ============

export interface ExtensionSettings {
  enabled: boolean;
  autoBlock: boolean;
  showNotifications: boolean;
  whitelist: string[];
  blacklist: string[];
}

export interface BlockedUrl {
  url: string;
  timestamp: string;
  reason: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
}

// ============ Utility Types ============

export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';
export type Action = 'allow' | 'block';

// ============ Settings Types ============

export interface Settings {
  autoRefresh: boolean;
  refreshInterval: number;
  notifications: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface DashboardSettings {
  theme: 'light' | 'dark' | 'system';
  apiBaseUrl: string;
  autoRefresh: boolean;
  refreshInterval: number;
  notificationsEnabled: boolean;
}

// Type guards
export function isPhishing(result: AnalysisResult): boolean {
  return result.action === 'block';
}

