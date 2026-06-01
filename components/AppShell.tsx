import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar />
      <main className="w-full max-w-[1400px] flex-1 px-12 py-10">{children}</main>
    </div>
  );
}
