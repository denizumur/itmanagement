import {
  IconBell,
  IconClipboardList,
  IconDashboard,
  IconDevices,
  IconLicense,
  IconTool,
  IconUsers,
} from "@tabler/icons-react";
import { NavLink } from "react-router";
import { cn } from "../../lib/cn";

const items = [
  { to: "/", label: "Genel bakış", icon: IconDashboard },
  { to: "/workspace", label: "Çalışma alanı", icon: IconClipboardList },
  { to: "/assets", label: "Envanter", icon: IconDevices },
  { to: "/assignments", label: "Zimmet", icon: IconUsers },
  { to: "/licenses", label: "Lisanslar", icon: IconLicense },
  { to: "/maintenance", label: "Bakım", icon: IconTool },
  { to: "/reminders", label: "Hatırlatıcılar", icon: IconBell },
];

export function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-[190px] border-r border-border bg-surface-1 p-md md:block">
      <div className="mb-xl">
        <p className="text-h3">IT Yönetim</p>
        <p className="text-caption text-text-secondary">Envanter platformu</p>
      </div>

      <nav className="space-y-sm">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-sm rounded-app px-md py-sm text-body transition",
                  isActive
                    ? "bg-accent-bg text-accent"
                    : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                )
              }
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}