import type { HTMLAttributes } from "react";

export type ProgressSize = "sm" | "md" | "lg";
export type ProgressColor = "accent" | "success" | "warning" | "error";

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: ProgressSize;
  color?: ProgressColor;
  label?: string;
  showValue?: boolean;
}
