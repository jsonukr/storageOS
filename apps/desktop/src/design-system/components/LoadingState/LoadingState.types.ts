import type { HTMLAttributes } from "react";

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  message?: string;
  size?: "sm" | "md" | "lg";
}
