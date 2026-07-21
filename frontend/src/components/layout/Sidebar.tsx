import {
  IconBell,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconDashboard,
  IconDevices,
  IconHistory,
  IconLicense,
  IconSparkles,
  IconTool,
  IconUsers,
} from "@tabler/icons-react";
import { NavLink } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { cn } from "../../lib/cn";

type SidebarItem = {
  to: string;
  label: string;
  shortLabel: string;
  icon: typeof IconDashboard;
  roles?: string[];
};

const items: SidebarItem[] = [
  { to: "/", label: "Genel Bakış", shortLabel: "Özet", icon: IconDashboard },
  {
    to: "/tickets",
    label: "Ticketlar",
    shortLabel: "Ticket",
    icon: IconClipboardList,
  },
  {
    to: "/workspace",
    label: "Çalışma Alanı",
    shortLabel: "Alan",
    icon: IconClipboardList,
  },
  { to: "/assets", label: "Envanter", shortLabel: "Varlık", icon: IconDevices },
  { to: "/assignments", label: "Zimmet", shortLabel: "Zimmet", icon: IconUsers },
  {
    to: "/licenses",
    label: "Lisanslar",
    shortLabel: "Lisans",
    icon: IconLicense,
  },
  { to: "/maintenance", label: "Bakım", shortLabel: "Bakım", icon: IconTool },
  {
    to: "/reminders",
    label: "Hatırlatıcılar",
    shortLabel: "Alarm",
    icon: IconBell,
  },
  { to: "/personnel", label: "Personel", shortLabel: "Ekip", icon: IconUsers },
  {
    to: "/audit",
    label: "İşlem Geçmişi",
    shortLabel: "Audit",
    icon: IconHistory,
    roles: ["admin"],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function Sidebar({
  collapsed = false,
  onToggleCollapsed,
}: SidebarProps) {
  const { user } = useAuth();

  const visibleItems = items.filter((item) => {
    if (!item.roles) {
      return true;
    }

    return item.roles.includes(user?.role ?? "");
  });

  return (
    <aside
      className={cn(
        "sidebar-glass hidden min-h-screen shrink-0 border-r border-border bg-surface-1/95 px-md py-lg transition-[width] duration-200 ease-out md:flex md:flex-col",
        collapsed ? "w-[84px]" : "w-[264px]"
      )}
    >
      <div
        className={cn(
          "mb-lg flex items-center rounded-panel border border-border bg-surface-1 shadow-panel",
          collapsed ? "justify-center p-sm" : "justify-between gap-sm p-md"
        )}
      >
        <div className="flex min-w-0 items-center gap-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-bg text-accent">
            <IconSparkles size={20} aria-hidden={true} />
          </div>

          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-h3 text-text-primary">IT Yönetim</p>
              <p className="truncate text-caption text-text-secondary">
                Admin Panel
              </p>
            </div>
          ) : null}
        </div>

        {!collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            aria-label="Menüyü daralt"
            title="Menüyü daralt"
          >
            <IconChevronLeft size={18} aria-hidden={true} />
          </button>
        ) : null}
      </div>

      {collapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="mb-lg inline-flex h-10 w-10 items-center justify-center self-center rounded-xl border border-border bg-surface-1 text-text-secondary shadow-panel transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Menüyü genişlet"
          title="Menüyü genişlet"
        >
          <IconChevronRight size={18} aria-hidden={true} />
        </button>
      ) : null}

      {!collapsed ? (
        <p className="mb-sm px-sm text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Menü
        </p>
      ) : null}

      <nav className="flex flex-1 flex-col gap-xs">
        {visibleItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  "group flex items-center rounded-xl border px-sm py-sm text-body font-medium outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-accent/30",
                  collapsed ? "justify-center" : "gap-sm",
                  isActive
                    ? "border-accent/20 bg-accent-bg text-accent shadow-sm"
                    : "border-transparent text-text-secondary hover:border-border hover:bg-surface-2 hover:text-text-primary"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition",
                      isActive
                        ? "bg-surface-1 text-accent"
                        : "bg-transparent text-inherit group-hover:bg-surface-1"
                    )}
                  >
                    <Icon size={19} aria-hidden={true} />
                  </span>

                  {!collapsed ? (
                    <span className="min-w-0 truncate">{item.label}</span>
                  ) : (
                    <span className="sr-only">{item.label}</span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {!collapsed ? (
        <div className="mt-lg rounded-panel border border-border bg-surface-2 p-md">
          <p className="text-caption font-semibold text-text-primary">
            Aktif kullanıcı
          </p>
          <p className="mt-xs truncate text-caption text-text-secondary">
            {user?.username ?? "Kullanıcı"}
          </p>
          <p className="mt-xs inline-flex rounded-full bg-surface-1 px-sm py-xs text-[11px] font-semibold text-text-secondary">
            {user?.role ?? "role yok"}
          </p>
        </div>
      ) : null}
    </aside>
  );
}