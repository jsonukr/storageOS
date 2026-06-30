import type { HTMLAttributes } from "react";
import type { SemanticColor } from "../../tokens";

export type BadgeVariant = "filled" | "outlined" | "subtle";
export type BadgeColor = SemanticColor | "default";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  color?: BadgeColor;
  size?: "sm" | "md";
}
