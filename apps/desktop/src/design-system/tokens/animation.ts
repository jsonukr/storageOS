export const duration = {
  ultraFast: "duration-[50ms]",
  fast: "duration-[83ms]",
  normal: "duration-[167ms]",
  gentle: "duration-[250ms]",
  slow: "duration-[333ms]",
} as const;

export const easing = {
  decelerate: "[transition-timing-function:cubic-bezier(0,0,0,1)]",
  accelerate: "[transition-timing-function:cubic-bezier(1,0,1,1)]",
  standard: "[transition-timing-function:cubic-bezier(0.8,0,0.2,1)]",
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
