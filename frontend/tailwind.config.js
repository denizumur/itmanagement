/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        "accent-foreground": "var(--color-accent-foreground)",

        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
        success: "var(--color-success)",

        "danger-foreground": "var(--color-danger-foreground)",
        "warning-foreground": "var(--color-warning-foreground)",
        "success-foreground": "var(--color-success-foreground)",

        "accent-bg": "var(--bg-accent)",
        "danger-bg": "var(--bg-danger)",
        "warning-bg": "var(--bg-warning)",
        "success-bg": "var(--bg-success)",

        "surface-0": "var(--surface-0)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",

        border: "var(--border)",
        "border-subtle": "var(--border-subtle)",
        "border-strong": "var(--border-strong)",

        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
      },
      spacing: {
        xs: "var(--gap-xs)",
        sm: "var(--gap-sm)",
        md: "var(--gap-md)",
        lg: "var(--gap-lg)",
        xl: "var(--gap-xl)",
      },
      borderRadius: {
        app: "var(--radius)",
        panel: "var(--radius-panel)",
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        card: "var(--shadow-card)",
        popover: "var(--shadow-popover)",
      },
      fontSize: {
        display: ["var(--font-display)", { lineHeight: "1.2", fontWeight: "600" }],
        h2: ["var(--font-h2)", { lineHeight: "1.3", fontWeight: "600" }],
        h3: ["var(--font-h3)", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["var(--font-body)", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["var(--font-caption)", { lineHeight: "1.4", fontWeight: "500" }],
      },
    },
  },
  plugins: [],
};