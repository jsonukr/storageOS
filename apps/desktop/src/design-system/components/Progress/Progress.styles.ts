import type { ProgressSize, ProgressColor } from "./Progress.types";

const trackBase = "w-full rounded-full bg-surface-tertiary overflow-hidden";

const trackSizes: Record<ProgressSize, string> = {
  sm: "h-[3px]",
  md: "h-1.5",
  lg: "h-2.5",
};

const barColors: Record<ProgressColor, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-danger",
};

export function getTrackClasses(size: ProgressSize): string {
  return `${trackBase} ${trackSizes[size]}`;
}

export function getBarClasses(color: ProgressColor): string {
  return `h-full rounded-full transition-all duration-[250ms] [transition-timing-function:cubic-bezier(0,0,0,1)] ${barColors[color]}`;
}
