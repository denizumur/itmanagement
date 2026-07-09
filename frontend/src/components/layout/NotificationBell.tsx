import { IconBell } from "@tabler/icons-react";
import { motion } from "framer-motion";

interface NotificationBellProps {
  count: number;
}

export function NotificationBell({ count }: NotificationBellProps) {
  return (
    <motion.button
      type="button"
      className="relative rounded-app border border-border bg-surface-1 p-sm text-text-primary shadow-panel"
      aria-label="Hatırlatıcı bildirimleri"
      whileHover={{
        y: -2,
        scale: 1.03,
      }}
      whileTap={{
        scale: 0.96,
      }}
    >
      <IconBell size={18} aria-hidden="true" />

      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-danger-bg px-xs text-center text-[10px] text-danger">
          {count}
        </span>
      )}
    </motion.button>
  );
}