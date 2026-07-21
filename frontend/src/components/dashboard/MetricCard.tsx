import {
  IconAlertTriangle,
  IconDevices,
  IconTicket,
  IconTool,
} from "@tabler/icons-react";
import type { MetricCardDto, RoleColor } from "../../types/dashboard";
import { MiniMetricCard } from "../common/MiniMetricCard";
import { StatusBadge } from "../ui/StatusBadge";

const iconMap = {
  devices: IconDevices,
  "alert-triangle": IconAlertTriangle,
  ticket: IconTicket,
  tool: IconTool,
};

const metricTone: Record<RoleColor, "accent" | "danger" | "warning" | "success"> = {
  accent: "accent",
  danger: "danger",
  warning: "warning",
  success: "success",
};

interface MetricCardProps {
  card: MetricCardDto;
}

export function MetricCard({ card }: MetricCardProps) {
  const Icon = iconMap[card.icon as keyof typeof iconMap] ?? IconDevices;

  return (
    <div className="flex min-w-[180px] items-center gap-sm">
      <MiniMetricCard
        label={card.label}
        value={card.value}
        tone={metricTone[card.role]}
        icon={<Icon size={17} aria-hidden={true} />}
        className="w-full"
      />

      {card.module_ready === false ? (
        <StatusBadge variant="warning">Yakında</StatusBadge>
      ) : null}
    </div>
  );
}