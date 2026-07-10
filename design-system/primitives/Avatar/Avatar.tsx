"use client";

/**
 * Person avatar with an initials fallback — the Primitive `StudentCard`,
 * `InstructorCard`, `LeadCard`, etc. (component-library-specification.md
 * §5.3) compose from, once built. This sprint ships the Primitive only.
 */
import { useState } from "react";
import { cn } from "../../utils/cn";
import type { PrimitiveSize } from "../internal/types";
import { VisuallyHidden } from "../internal/VisuallyHidden";
import styles from "../primitives.module.css";

export const AVATAR_STATUS_KEYS = ["online", "away", "busy", "offline"] as const;
export type AvatarStatus = (typeof AVATAR_STATUS_KEYS)[number];

const SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.avatarSm,
  md: styles.avatarMd,
  lg: styles.avatarLg,
};

const STATUS_CLASS: Record<AvatarStatus, string> = {
  online: styles.avatarStatusOnline,
  away: styles.avatarStatusAway,
  busy: styles.avatarStatusBusy,
  offline: styles.avatarStatusOffline,
};

const STATUS_LABEL: Record<AvatarStatus, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
  offline: "Offline",
};

export interface AvatarProps {
  src?: string;
  /** Full name — source of both the `alt` text and the initials fallback. */
  name: string;
  /** @default "md" */
  size?: PrimitiveSize;
  status?: AvatarStatus;
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function Avatar({ src, name, size = "md", status, className }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(src) && !imageFailed;

  return (
    <span className={cn(styles.avatar, SIZE_CLASS[size], className)}>
      {showImage ? (
        // A Foundation Primitive renders arbitrary, runtime-supplied entity
        // photo URLs (student/instructor/lead), not a static app asset;
        // next/image requires build-time domain allowlisting this generic
        // primitive cannot assume on behalf of every future consumer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className={styles.avatarImage} onError={() => setImageFailed(true)} />
      ) : (
        <span className={styles.avatarFallback} role="img" aria-label={name}>
          {getInitials(name)}
        </span>
      )}
      {status ? (
        <span className={cn(styles.avatarStatus, STATUS_CLASS[status])} title={STATUS_LABEL[status]}>
          <VisuallyHidden>{STATUS_LABEL[status]}</VisuallyHidden>
        </span>
      ) : null}
    </span>
  );
}
