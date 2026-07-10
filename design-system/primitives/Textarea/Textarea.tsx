"use client";

/** Multi-line text field. Same field chrome as `Input`, minus the addon slots. */
import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import { focusRingClassName } from "../../a11y";
import styles from "../primitives.module.css";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  helperText?: ReactNode;
  /** @default "vertical" */
  resize?: "vertical" | "none";
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    invalid = false,
    helperText,
    resize = "vertical",
    rows = 4,
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
    <div className={wrapperClassName}>
      <textarea
        {...props}
        ref={ref}
        id={id ?? generatedId}
        rows={rows}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={cn(ariaDescribedBy, helperTextId) || undefined}
        className={cn(
          styles.textarea,
          focusRingClassName,
          invalid && styles.fieldInvalid,
          resize === "vertical" ? styles.textareaResizeVertical : styles.textareaResizeNone,
          className
        )}
      />
      {helperText ? (
        <p id={helperTextId} className={cn(styles.fieldHelperText, invalid && styles.fieldHelperTextInvalid)}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
