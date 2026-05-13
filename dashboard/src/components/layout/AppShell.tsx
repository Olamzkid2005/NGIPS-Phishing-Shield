'use client';

import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return <Sidebar>{children}</Sidebar>;
}
