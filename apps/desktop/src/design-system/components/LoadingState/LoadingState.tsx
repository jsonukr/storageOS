import { forwardRef } from "react";
import type { LoadingStateProps } from "./LoadingState.types";
import { loadingStateClasses as styles } from "./LoadingState.styles";
import { Spinner } from "../Spinner";

export const LoadingState = forwardRef<HTMLDivElement, LoadingStateProps>(
  function LoadingState(
    { message = "Loading...", size = "md", className = "", ...rest },
    ref,
  ) {
    return (
      <div ref={ref} className={`${styles.container} ${className}`} {...rest}>
        <Spinner size={size} label={message} />
        <p className={styles.message}>{message}</p>
      </div>
    );
  },
);
