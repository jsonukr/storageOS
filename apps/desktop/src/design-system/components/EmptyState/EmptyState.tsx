import { forwardRef } from "react";
import type { EmptyStateProps } from "./EmptyState.types";
import { emptyStateClasses as styles } from "./EmptyState.styles";

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  function EmptyState(
    { icon, title, description, action, className = "", ...rest },
    ref,
  ) {
    return (
      <div ref={ref} className={`${styles.container} ${className}`} {...rest}>
        {icon && (
          <div className={styles.icon} aria-hidden="true">
            {icon}
          </div>
        )}
        <h3 className={styles.title}>{title}</h3>
        {description && <p className={styles.description}>{description}</p>}
        {action && <div className={styles.action}>{action}</div>}
      </div>
    );
  },
);
