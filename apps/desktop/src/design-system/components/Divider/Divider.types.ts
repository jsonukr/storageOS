import type { HTMLAttributes } from "react";

export type DividerOrientation = "horizontal" | "vertical";

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: DividerOrientation;
  spacing?: "sm" | "md" | "lg";
}
