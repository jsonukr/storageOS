import type { ButtonVariant, ButtonSize } from "./Button.types";

const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-200 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:pointer-events-none select-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover active:bg-accent-hover",
  secondary:
    "bg-surface-secondary text-text-primary border border-border hover:bg-surface-tertiary active:bg-surface-tertiary",
  ghost:
    "bg-transparent text-text-primary hover:bg-surface-secondary active:bg-surface-tertiary",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 dark:bg-red-700 dark:hover:bg-red-600",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-base",
};

export function getButtonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean,
): string {
  return `${base} ${variants[variant]} ${sizes[size]}${fullWidth ? " w-full" : ""}`;
}
