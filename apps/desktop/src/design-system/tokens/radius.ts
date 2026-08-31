export const radius = {
  none: "rounded-none",
  sm: "rounded-[4px]",
  md: "rounded-[6px]",
  lg: "rounded-[8px]",
  xl: "rounded-[12px]",
  full: "rounded-full",
} as const;

export type Radius = keyof typeof radius;
