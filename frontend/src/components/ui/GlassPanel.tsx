import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassPanel({
  children,
  className,
  hover = true,
}: GlassPanelProps) {
  return (
    <motion.div
      className={cn(
        "glass-panel rounded-panel border border-border bg-surface-1 shadow-panel",
        hover && "glass-panel-hover",
        className
      )}
      initial={{
        opacity: 0,
        y: 8,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.2,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.div>
  );
}