"use client";

/**
 * Single radio control, built on a visually hidden native
 * `<input type="radio">` plus a styled sibling dot. Composed into a group
 * by giving multiple `Radio`s the same `name` — a `RadioGroup` wrapper is
 * not named in this sprint's BUILD list and is not built here.
 */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import { visuallyHiddenStyle } from "../../a11y";
import type { PrimitiveSize } from "../internal/types";
import styles from "../primitives.module.css";

const DOT_SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.radioDotSm,
  md: styles.radioDotMd,
  lg: styles.radioDotLg,
};

const LABEL_SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.choiceLabelSm,
  md: styles.choiceLabelMd,
  lg: styles.choiceLabelLg,
};

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  /** @default "md" */
  size?: PrimitiveSize;
  children?: ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { size = "md", disabled, className, children, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label htmlFor={inputId} className={cn(styles.choiceRoot, disabled && styles.choiceRootDisabled, className)}>
      <input
        {...props}
        ref={ref}
        id={inputId}
        type="radio"
        disabled={disabled}
        className={styles.choiceInput}
        style={visuallyHiddenStyle}
      />
      <span className={cn(styles.radioDot, DOT_SIZE_CLASS[size])} aria-hidden="true">
        <span className={styles.radioDotInner} />
      </span>
      {children ? <span className={LABEL_SIZE_CLASS[size]}>{children}</span> : null}
    </label>
  );
});
