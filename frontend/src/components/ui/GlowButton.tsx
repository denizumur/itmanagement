import { motion, useReducedMotion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useState } from "react";
import { cn } from "../../lib/cn";

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

type GlowButtonVariant = "primary" | "ghost" | "danger";

interface GlowButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: ReactNode;
  variant?: GlowButtonVariant;
  icon?: ReactNode;
}

const variantClass: Record<GlowButtonVariant, string> = {
  primary: "glow-button-primary text-surface-1",
  ghost: "glow-button-ghost text-text-primary",
  danger: "glow-button-danger text-danger",
};

export function GlowButton({
  children,
  className,
  variant = "primary",
  icon,
  onMouseDown,
  type = "button",
  ...props
}: GlowButtonProps) {
  const shouldReduceMotion = useReducedMotion();
  const [ripples, setRipples] = useState<Ripple[]>([]);

  function handleMouseDown(event: ReactMouseEvent<HTMLButtonElement>) {
    onMouseDown?.(event);

    if (shouldReduceMotion || event.defaultPrevented) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const id = Date.now();

    setRipples((currentRipples) => [
      ...currentRipples,
      {
        id,
        size,
        x: event.clientX - rect.left - size / 2,
        y: event.clientY - rect.top - size / 2,
      },
    ]);

    window.setTimeout(() => {
      setRipples((currentRipples) =>
        currentRipples.filter((ripple) => ripple.id !== id)
      );
    }, 260);
  }

  return (
    <motion.button
      {...props}
      type={type}
      className={cn(
        "glow-button inline-flex items-center justify-center gap-sm rounded-app px-md py-sm text-body font-medium disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
        variantClass[variant],
        className
      )}
      onMouseDown={handleMouseDown}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
    >
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="glow-ripple"
          style={{
            width: ripple.size,
            height: ripple.size,
            left: ripple.x,
            top: ripple.y,
          }}
          initial={{
            scale: 0,
            opacity: 0.45,
          }}
          animate={{
            scale: 1,
            opacity: 0,
          }}
          transition={{
            duration: 0.22,
            ease: "easeOut",
          }}
        />
      ))}

      {icon ? <span className="relative z-10">{icon}</span> : null}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}