import { motion, useReducedMotion } from "framer-motion";
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
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        "glass-panel rounded-panel border border-border bg-surface-1 shadow-panel motion-reduce:transition-none",
        hover && "glass-panel-hover",
        className
      )}
      initial={
        shouldReduceMotion
          ? false
          : {
              opacity: 0,
              y: 6,
            }
      }
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.18,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.div>
  );
}