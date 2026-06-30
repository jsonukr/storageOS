import type { ImgHTMLAttributes } from "react";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "size"> {
  size?: AvatarSize;
  name?: string;
  src?: string;
}
