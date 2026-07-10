import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import styles from "../primitives.module.css";

/**
 * Shared wrapper for every text-entry Primitive (Input, EmailInput,
 * PasswordInput, SearchInput, NumberInput) — owns the addon-slot layout
 * and helper/error text row so that structure is defined exactly once
 * (Sprint 2 review gate: "No duplicated code").
 */
export interface FieldShellProps {
  startAddon?: ReactNode;
  endAddon?: ReactNode;
  helperText?: ReactNode;
  helperTextId?: string;
  invalid?: boolean;
  className?: string;
  children: ReactNode;
}

export function FieldShell({
  startAddon,
  endAddon,
  helperText,
  helperTextId,
  invalid,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={className}>
      <div className={styles.fieldWrapper}>
        {startAddon ? <span className={styles.fieldAddonStart}>{startAddon}</span> : null}
        {children}
        {endAddon ? <span className={styles.fieldAddonEnd}>{endAddon}</span> : null}
      </div>
      {helperText ? (
        <p id={helperTextId} className={cn(styles.fieldHelperText, invalid && styles.fieldHelperTextInvalid)}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
