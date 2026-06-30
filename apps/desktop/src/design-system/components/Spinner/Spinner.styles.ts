import type { SpinnerSize } from "./Spinner.types";

const sizes: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

export function getSpinnerClasses(size: SpinnerSize): string {
  return `${sizes[size]} animate-spin text-current`;
}
