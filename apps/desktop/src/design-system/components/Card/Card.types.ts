import type { HTMLAttributes, ReactNode } from "react";

export type CardVariant = "default" | "outlined" | "elevated";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
  header?: ReactNode;
  footer?: ReactNode;
}
