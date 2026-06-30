import type { InputSize } from "./Input.types";

const base =
  "w-full bg-surface border border-border rounded-md text-text-primary placeholder:text-text-secondary transition-colors duration-200 focus:outline-2 focus:outline-offset-0 focus:outline-accent disabled:opacity-50 disabled:cursor-not-allowed";

const sizes: Record<InputSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-3 text-sm",
  lg: "h-10 px-4 text-base",
};

const withLeadingIcon: Record<InputSize, string> = {
  sm: "pl-8",
  md: "pl-9",
  lg: "pl-10",
};

const withTrailingIcon: Record<InputSize, string> = {
  sm: "pr-8",
  md: "pr-9",
  lg: "pr-10",
};

export function getInputClasses(
  size: InputSize,
  hasLeadingIcon: boolean,
  hasTrailingIcon: boolean,
  hasError: boolean,
): string {
  let classes = `${base} ${sizes[size]}`;
  if (hasLeadingIcon) classes += ` ${withLeadingIcon[size]}`;
  if (hasTrailingIcon) classes += ` ${withTrailingIcon[size]}`;
  if (hasError) classes += " border-red-500 focus:outline-red-500";
  return classes;
}
