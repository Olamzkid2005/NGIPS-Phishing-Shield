import { useState, createContext, useContext, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Menu,
  X,
  Moon,
  Sun,
  BarChart3,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/utils';
import { useSettingsStore } from '@/store';

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
  isMobileOpen: false,
  setIsMobileOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

interface SidebarProps {
  children: ReactNode;
}

export const Sidebar = ({ children }: SidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { theme, setTheme } = useSettingsStore();
  const pathname = usePathname();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Analyzer', href: '/analyzer', icon: Search },
    { name: 'History', href: '/history', icon: History },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Feedback', href: '/feedback', icon: MessageSquare },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Mobile overlay */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed left-0 top-0 z-50 flex h-full flex-col border-r border-gray-200 bg-white transition-all duration-300 dark:border-gray-700 dark:bg-gray-800',
            isCollapsed ? 'w-16' : 'w-64',
            isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
            {!isCollapsed && (
              <Link to="/" className="flex items-center gap-2">
                <Shield className="h-8 w-8 text-primary-600" />
                <span className="font-bold text-gray-900 dark:text-white">NGIPS Shield</span>
              </Link>
            )}
            {isCollapsed && <Shield className="h-8 w-8 text-primary-600" />}

            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700',
                    isCollapsed && 'justify-center px-2'
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Theme toggle */}
          <div className="border-t border-gray-200 p-2 dark:border-gray-700">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-5 w-5" />
                  {!isCollapsed && <span>Light Mode</span>}
                </>
              ) : (
                <>
                  <Moon className="h-5 w-5" />
                  {!isCollapsed && <span>Dark Mode</span>}
                </>
              )}
            </button>
          </div>

          {/* Collapse toggle (desktop only) */}
          <div className="hidden border-t border-gray-200 p-2 dark:border-gray-700 lg:block">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex w-full items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className={cn('transition-all duration-300', isCollapsed ? 'lg:pl-16' : 'lg:pl-64')}>
          {/* Top bar (mobile) */}
          <div className="sticky top-0 z-30 flex h-16 items-center border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800 lg:hidden">
            <button onClick={() => setIsMobileOpen(true)} className="mr-4">
              <Menu className="h-6 w-6" />
            </button>
            <Shield className="h-8 w-8 text-primary-600" />
            <span className="ml-2 font-bold text-gray-900 dark:text-white">NGIPS Shield</span>
          </div>

          {/* Page content */}
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
};

export default Sidebar;