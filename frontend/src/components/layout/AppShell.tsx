import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  children: ReactNode;
  reminderCount?: number;
}

export function AppShell({ children, reminderCount = 0 }: AppShellProps) {
  return (
    <div className="app-bg min-h-screen text-text-primary">
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Topbar reminderCount={reminderCount} />
          <main className="p-lg md:p-xl">{children}</main>
        </div>
      </div>
    </div>
  );
}