export const fontFamily = {
  sans: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
  mono: '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
} as const;

export const fontSize = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
} as const;

export const fontWeight = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
} as const;

export const lineHeight = {
  tight: "leading-tight",
  normal: "leading-normal",
  relaxed: "leading-relaxed",
} as const;

export type FontSize = keyof typeof fontSize;
export type FontWeight = keyof typeof fontWeight;
