import type { ButtonVariant, ButtonSize } from "./Button.types";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-[4px] transition-all duration-[167ms] [transition-timing-function:cubic-bezier(0,0,0,1)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-border-focus)] disabled:opacity-40 disabled:pointer-events-none select-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover active:bg-accent-pressed",
  secondary:
    "bg-surface-card text-text-primary border border-border hover:bg-surface-hover active:bg-surface-tertiary",
  ghost:
    "bg-transparent text-text-primary hover:bg-surface-hover active:bg-surface-tertiary",
  danger:
    "bg-danger text-white hover:bg-danger/90 active:bg-danger/80",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[12px]",
  md: "h-8 px-3.5 text-[13px]",
  lg: "h-9 px-4 text-[14px]",
};

export function getButtonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean,
): string {
  return `${base} ${variants[variant]} ${sizes[size]}${fullWidth ? " w-full" : ""}`;
}
