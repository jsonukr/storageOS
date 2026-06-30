export const duration = {
  fast: "duration-100",
  normal: "duration-200",
  slow: "duration-300",
} as const;

export const easing = {
  default: "ease-in-out",
  in: "ease-in",
  out: "ease-out",
} as const;

export const transition = {
  colors: "transition-colors",
  opacity: "transition-opacity",
  transform: "transition-transform",
  all: "transition-all",
} as const;

export type Duration = keyof typeof duration;
