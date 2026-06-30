import { forwardRef } from "react";
import type { DeviceCardProps } from "./DeviceCard.types";
import {
  deviceCardClasses as styles,
  statusConfig,
} from "./DeviceCard.styles";

export const DeviceCard = forwardRef<HTMLDivElement, DeviceCardProps>(
  function DeviceCard(
    { name, icon, status, type, lastSeen, className = "", ...rest },
    ref,
  ) {
    const config = statusConfig[status];

    return (
      <div ref={ref} className={`${styles.container} ${className}`} {...rest}>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        <div className={styles.content}>
          <span className={styles.name}>{name}</span>
          <span className={styles.meta}>
            {[type, lastSeen].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div className={styles.statusContainer}>
          <span className="text-xs text-text-secondary">{config.label}</span>
          <span
            className={`inline-block h-2 w-2 rounded-full ${config.dot}`}
            role="status"
            aria-label={config.label}
          />
        </div>
      </div>
    );
  },
);
