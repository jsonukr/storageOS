import { forwardRef, useState } from "react";
import type { AvatarProps } from "./Avatar.types";
import { getAvatarClasses } from "./Avatar.styles";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(function Avatar(
  { size = "md", name, src, alt, className = "", ...rest },
  ref,
) {
  const [imgError, setImgError] = useState(false);
  const classes = getAvatarClasses(size);
  const showImage = src && !imgError;
  const label = alt ?? name ?? "Avatar";

  return (
    <div ref={ref} className={`${classes} ${className}`} role="img" aria-label={label}>
      {showImage ? (
        <img
          src={src}
          alt={label}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
          {...rest}
        />
      ) : (
        <span aria-hidden="true">
          {name ? getInitials(name) : "?"}
        </span>
      )}
    </div>
  );
});
