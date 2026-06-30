import type { AvatarSize } from "./Avatar.types";

const base =
  "inline-flex items-center justify-center rounded-full bg-surface-tertiary text-text-secondary font-medium shrink-0 overflow-hidden";

const sizes: Record<AvatarSize, string> = {
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
  xl: "h-12 w-12 text-lg",
};

export function getAvatarClasses(size: AvatarSize): string {
  return `${base} ${sizes[size]}`;
}
