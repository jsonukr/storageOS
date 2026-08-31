export const fontFamily = {
  sans: '"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, sans-serif',
  mono: '"Cascadia Code", "JetBrains Mono", "Fira Code", monospace',
} as const;

export const fontSize = {
  caption: "text-[12px] leading-[16px]",
  body: "text-[14px] leading-[20px]",
  bodyStrong: "text-[14px] leading-[20px] font-semibold",
  bodyLarge: "text-[16px] leading-[22px]",
  subtitle: "text-[20px] leading-[28px]",
  title: "text-[28px] leading-[36px]",
  titleLarge: "text-[40px] leading-[52px]",
  display: "text-[68px] leading-[92px]",
  xs: "text-[11px] leading-[14px]",
  sm: "text-[12px] leading-[16px]",
  base: "text-[14px] leading-[20px]",
  lg: "text-[16px] leading-[22px]",
  xl: "text-[20px] leading-[28px]",
  "2xl": "text-[28px] leading-[36px]",
  "3xl": "text-[40px] leading-[52px]",
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
