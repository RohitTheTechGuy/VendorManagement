import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { RequirementStage } from "@vendor-management/shared";
import { STAGE_STYLE } from "../lib/stage.js";
import { Button as ShadButton } from "@/components/ui/button";

// Single source of truth for class merging (shadcn's cn). Re-exported so the
// many `import { cn } from "./ui.js"` call sites keep working.
export { cn } from "../lib/utils.js";
import { cn } from "../lib/utils.js";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
};

// The legacy Button API (primary/secondary/ghost · sm/md) is kept so the ~12
// existing call sites don't change, but it now renders the shadcn Button so the
// whole app shares one token-based, dark-aware primitive.
const VARIANT_MAP = { primary: "default", secondary: "outline", ghost: "ghost" } as const;
const SIZE_MAP = { sm: "sm", md: "default" } as const;

export function Button({ variant = "primary", size = "md", ...props }: ButtonProps) {
  return <ShadButton variant={VARIANT_MAP[variant]} size={SIZE_MAP[size]} {...props} />;
}

export function Card({
  className,
  children,
  onClick,
  accent = false,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  // Draw the signature purple→pink gradient hairline flush to the top edge.
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-border bg-card text-card-foreground shadow-sm",
        accent && "accent-top",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary",
        className,
      )}
    />
  );
}

export function StageBadge({ stage }: { stage: RequirementStage }) {
  const style = STAGE_STYLE[stage];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] ring-1 ring-inset",
        style.badge,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          style.dot,
          stage === "IN_PROGRESS" && "motion-safe:animate-pulse",
        )}
      />
      {style.label}
    </span>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * Editorial helpers for the "dossier" aesthetic.
 * Label — uppercase letterspaced mono micro-label (section headers, meta).
 * Mono  — mono numerals / codes (counts, IDs), muted by default.
 * Kbd   — a keyboard-hint chip (⌘K).
 */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground", className)}>
      {children}
    </span>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-xs tabular-nums tracking-wide text-muted-foreground", className)}>
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}
