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
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-card text-card-foreground shadow-sm", className)}
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        style.badge,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}
