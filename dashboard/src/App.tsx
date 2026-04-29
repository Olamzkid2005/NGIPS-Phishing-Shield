import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/layout';
import { DashboardPage, AnalyzerPage, HistoryPage, SettingsPage, AnalyticsPage, FeedbackPage } from '@/pages';
import { ToastContainer } from '@/components/ui';
import { useAppStore } from '@/store';
import { useEffect } from 'react';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const { notification, clearNotification } = useAppStore();

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        clearNotification();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Sidebar>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/analyzer" element={<AnalyzerPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Sidebar>

        {/* Toast Notifications */}
        {notification && (
          <div className="fixed right-4 top-4 z-50">
            <ToastContainer
              toasts={[
                {
                  id: '1',
                  message: notification.message,
                  type: notification.type,
                },
              ]}
              onRemove={() => clearNotification()}
            />
          </div>
        )}
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;