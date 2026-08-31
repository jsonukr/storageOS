import type { InputSize } from "./Input.types";

const base =
  "w-full bg-surface-input border border-border rounded-[4px] text-text-primary placeholder:text-text-tertiary transition-all duration-[167ms] [transition-timing-function:cubic-bezier(0,0,0,1)] hover:bg-surface-input-hover focus:outline-none focus:border-accent focus:shadow-[0_0_0_1px_var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed";

const sizes: Record<InputSize, string> = {
  sm: "h-7 px-2.5 text-[12px]",
  md: "h-8 px-3 text-[13px]",
  lg: "h-9 px-3.5 text-[14px]",
};

const withLeadingIcon: Record<InputSize, string> = {
  sm: "pl-7",
  md: "pl-8",
  lg: "pl-9",
};

const withTrailingIcon: Record<InputSize, string> = {
  sm: "pr-7",
  md: "pr-8",
  lg: "pr-9",
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
  if (hasError) classes += " border-danger focus:border-danger focus:shadow-[0_0_0_1px_var(--color-danger)]";
  return classes;
}
