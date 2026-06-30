import type { HTMLAttributes, ReactNode } from "react";

export interface ErrorStateProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  message: string;
  icon?: ReactNode;
  retry?: () => void;
  retryLabel?: string;
}
