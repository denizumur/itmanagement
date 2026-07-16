import {
  IconBell,
  IconClipboardList,
  IconDashboard,
  IconDevices,
  IconLicense,
  IconSparkles,
  IconTool,
  IconUsers,
} from "@tabler/icons-react";
import { NavLink } from "react-router";
import { cn } from "../../lib/cn";

const items = [
  { to: "/", label: "Genel bakış", icon: IconDashboard },
  { to: "/tickets", label: "Ticketlar", icon: IconClipboardList },
  { to: "/workspace", label: "Çalışma alanı", icon: IconClipboardList },
  { to: "/assets", label: "Envanter", icon: IconDevices },
  { to: "/assignments", label: "Zimmet", icon: IconUsers },
  { to: "/licenses", label: "Lisanslar", icon: IconLicense },
  { to: "/maintenance", label: "Bakım", icon: IconTool },
  { to: "/reminders", label: "Hatırlatıcılar", icon: IconBell },
    { to: "/personnel", label: "Personel", icon: IconUsers },
];

export function Sidebar() {
  return (
    <aside className="sidebar-glass hidden min-h-screen w-[230px] p-md md:block">
      <div className="mb-xl rounded-panel border border-border bg-surface-1 p-md shadow-panel">
        <div className="flex items-center gap-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-app bg-accent-bg text-accent">
            <IconSparkles size={20} aria-hidden={true} />
          </div>

          <div>
            <p className="text-h3 text-text-primary">IT Yönetim</p>
            <p className="text-caption text-text-secondary">Control cockpit</p>
          </div>
        </div>
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
                  "sidebar-link flex items-center gap-sm rounded-app px-md py-sm text-body transition",
                  isActive
                    ? "sidebar-link-active text-accent"
                    : "text-text-secondary hover:text-text-primary"
                )
              }
            >
              <Icon className="relative z-10" size={18} aria-hidden={true} />
              <span className="relative z-10">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}