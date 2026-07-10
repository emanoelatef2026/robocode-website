"use client";

/**
 * Base single-line text field. `EmailInput`/`PasswordInput`/`SearchInput`/
 * `NumberInput` all wrap this component rather than reimplementing field
 * chrome (Composition over Duplication, DSA §2.8).
 */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import { focusRingClassName } from "../../a11y";
import type { PrimitiveSize } from "../internal/types";
import { FieldShell } from "../internal/FieldShell";
import styles from "../primitives.module.css";

const SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.fieldSm,
  md: styles.fieldMd,
  lg: styles.fieldLg,
};

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** @default "md" */
  size?: PrimitiveSize;
  /** Marks the field as failing validation — sets `aria-invalid` and applies error styling. */
  invalid?: boolean;
  /** Helper or error text rendered beneath the field and wired via `aria-describedby`. */
  helperText?: ReactNode;
  startAddon?: ReactNode;
  endAddon?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = "md",
    invalid = false,
    helperText,
    startAddon,
    endAddon,
    disabled,
    className,
    wrapperClassName,
    id,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const helperTextId = helperText ? `${id ?? generatedId}-helper` : undefined;

  return (
    <FieldShell
      className={wrapperClassName}
      startAddon={startAddon}
      endAddon={endAddon}
      helperText={helperText}
      helperTextId={helperTextId}
      invalid={invalid}
    >
      <input
        {...props}
        ref={ref}
        id={id ?? generatedId}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={cn(ariaDescribedBy, helperTextId) || undefined}
        className={cn(
          styles.field,
          focusRingClassName,
          SIZE_CLASS[size],
          invalid && styles.fieldInvalid,
          Boolean(startAddon) && styles.fieldWithStartAddon,
          Boolean(endAddon) && styles.fieldWithEndAddon,
          className
        )}
      />
    </FieldShell>
  );
});
