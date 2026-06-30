import type { ProgressSize, ProgressColor } from "./Progress.types";

const trackBase = "w-full rounded-full bg-surface-tertiary overflow-hidden";

const trackSizes: Record<ProgressSize, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

const barColors: Record<ProgressColor, string> = {
  accent: "bg-accent",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

export function getTrackClasses(size: ProgressSize): string {
  return `${trackBase} ${trackSizes[size]}`;
}

export function getBarClasses(color: ProgressColor): string {
  return `h-full rounded-full transition-all duration-300 ${barColors[color]}`;
}
