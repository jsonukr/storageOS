import type { DividerOrientation } from "./Divider.types";

const orientations: Record<DividerOrientation, string> = {
  horizontal: "w-full border-t border-border",
  vertical: "h-full border-l border-border",
};

const spacings = {
  sm: { horizontal: "my-2", vertical: "mx-2" },
  md: { horizontal: "my-4", vertical: "mx-4" },
  lg: { horizontal: "my-6", vertical: "mx-6" },
} as const;

export function getDividerClasses(
  orientation: DividerOrientation,
  spacing: "sm" | "md" | "lg",
): string {
  return `${orientations[orientation]} ${spacings[spacing][orientation]}`;
}
