import {
  IconAlertTriangle,
  IconDevices,
  IconTicket,
  IconTool,
} from "@tabler/icons-react";
import type { MetricCardDto, RoleColor } from "../../types/dashboard";
import { DataCard } from "../ui/DataCard";
import { StatusBadge } from "../ui/StatusBadge";

const iconMap = {
  devices: IconDevices,
  "alert-triangle": IconAlertTriangle,
  ticket: IconTicket,
  tool: IconTool,
};

const metricClass: Record<RoleColor, string> = {
  accent: "metric-card-accent",
  danger: "metric-card-danger",
  warning: "metric-card-warning",
  success: "metric-card-success",
};

interface MetricCardProps {
  card: MetricCardDto;
}

export function MetricCard({ card }: MetricCardProps) {
  const Icon = iconMap[card.icon as keyof typeof iconMap] ?? IconDevices;

  return (
    <DataCard className={`p-lg ${metricClass[card.role]}`}>
      <div className="flex items-start justify-between gap-md">
        <div>
          <div className="mb-md flex h-11 w-11 items-center justify-center rounded-app bg-surface-1 text-text-primary shadow-panel">
            <Icon size={21} aria-hidden={true} />
          </div>

          <p className="text-[30px] font-medium leading-none text-text-primary">
            {card.value}
          </p>

          <p className="mt-sm text-caption text-text-secondary">
            {card.label}
          </p>
        </div>

        {card.module_ready === false && (
          <StatusBadge variant="warning">Yakında</StatusBadge>
        )}
      </div>
    </DataCard>
  );
}