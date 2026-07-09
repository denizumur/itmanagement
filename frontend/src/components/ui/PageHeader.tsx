import { IconSparkles } from "@tabler/icons-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({
  eyebrow = "IT Yönetim Platformu",
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <motion.div
      className="mb-lg flex flex-col gap-md lg:flex-row lg:items-end lg:justify-between"
      variants={{
        hidden: {
          opacity: 0,
          y: 18,
        },
        show: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.42,
            ease: "easeOut",
          },
        },
      }}
    >
      <div>
        <div className="inline-flex items-center gap-sm rounded-full border border-border bg-surface-1 px-md py-sm text-caption text-text-secondary shadow-panel">
          <IconSparkles size={15} aria-hidden="true" />
          {eyebrow}
        </div>

        <h1 className="mt-md text-display text-text-primary">{title}</h1>

        {description && (
          <p className="mt-sm max-w-2xl text-body text-text-secondary">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-sm">{actions}</div>}
    </motion.div>
  );
}