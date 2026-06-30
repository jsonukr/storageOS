import { forwardRef } from "react";
import type { ErrorStateProps } from "./ErrorState.types";
import { errorStateClasses as styles } from "./ErrorState.styles";
import { Button } from "../Button";

export const ErrorState = forwardRef<HTMLDivElement, ErrorStateProps>(
  function ErrorState(
    {
      title = "Something went wrong",
      message,
      icon,
      retry,
      retryLabel = "Try again",
      className = "",
      ...rest
    },
    ref,
  ) {
    return (
      <div ref={ref} className={`${styles.container} ${className}`} role="alert" {...rest}>
        {icon && (
          <div className={styles.icon} aria-hidden="true">
            {icon}
          </div>
        )}
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        {retry && (
          <div className={styles.action}>
            <Button variant="secondary" size="sm" onClick={retry}>
              {retryLabel}
            </Button>
          </div>
        )}
      </div>
    );
  },
);
