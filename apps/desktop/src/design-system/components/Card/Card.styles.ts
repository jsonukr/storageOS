import type { CardVariant } from "./Card.types";

const base = "rounded-lg transition-colors duration-200";

const variants: Record<CardVariant, string> = {
  default: "bg-surface-secondary border border-border",
  outlined: "bg-transparent border border-border",
  elevated: "bg-surface-secondary shadow-md",
};

const paddings = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
} as const;

export function getCardClasses(
  variant: CardVariant,
  padding: keyof typeof paddings,
): string {
  return `${base} ${variants[variant]} ${paddings[padding]}`;
}
