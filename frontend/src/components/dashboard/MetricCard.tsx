import {
  IconAlertTriangle,
  IconDevices,
  IconTicket,
  IconTool,
} from "@tabler/icons-react";
import { roleSurfaceClass } from "../../lib/urgency";
import type { MetricCardDto } from "../../types/dashboard";

const iconMap = {
  devices: IconDevices,
  "alert-triangle": IconAlertTriangle,
  ticket: IconTicket,
  tool: IconTool,
};

interface MetricCardProps {
  card: MetricCardDto;
}

export function MetricCard({ card }: MetricCardProps) {
  const Icon = iconMap[card.icon as keyof typeof iconMap] ?? IconDevices;

  return (
    <div className={`rounded-panel p-lg ${roleSurfaceClass[card.role]}`}>
      <Icon size={20} aria-hidden="true" />
      <p className="mt-sm text-[24px] font-medium">{card.value}</p>
      <p className="text-caption">{card.label}</p>

      {card.module_ready === false && (
        <p className="mt-sm text-caption opacity-80">Modül yakında</p>
      )}
    </div>
  );
}