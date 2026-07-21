import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  children: ReactNode;
  reminderCount?: number;
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = "it-platform-sidebar-collapsed";

function getInitialSidebarCollapsed() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
}

export function AppShell({ children, reminderCount = 0 }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    getInitialSidebarCollapsed
  );

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      String(sidebarCollapsed)
    );
  }, [sidebarCollapsed]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => !current);
  }

  return (
    <div className="app-bg min-h-screen text-text-primary">
      <div className="flex min-h-screen">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
        />

        <div className="min-w-0 flex-1">
          <Topbar
            reminderCount={reminderCount}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={toggleSidebar}
          />

          <main className="mx-auto w-full max-w-[1680px] px-md py-lg md:px-lg xl:px-xl">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}