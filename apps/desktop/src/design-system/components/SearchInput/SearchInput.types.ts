import type { InputHTMLAttributes } from "react";

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  inputSize?: "sm" | "md" | "lg";
  onClear?: () => void;
}
