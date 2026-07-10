"use client";

/**
 * Single-value select. Wraps the native `<select>` rather than a custom
 * listbox — full keyboard/screen-reader support "for free"
 * (component-library-specification.md §12, "Semantic HTML first"). Multi-
 * value selection is `MultiSelect` (Predicted, §4.4), out of this sprint's
 * scope.
 */
import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import { focusRingClassName } from "../../a11y";
import type { PrimitiveSize } from "../internal/types";
import { ChevronDownGlyph } from "../internal/icons";
import styles from "../primitives.module.css";

const SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.fieldSm,
  md: styles.fieldMd,
  lg: styles.fieldLg,
};

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /** @default "md" */
  size?: PrimitiveSize;
  invalid?: boolean;
  helperText?: ReactNode;
  /** Convenience option list — alternative to passing `<option>` children directly. */
  options?: SelectOption[];
  placeholder?: string;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    size = "md",
    invalid = false,
    helperText,
    options,
    placeholder,
    disabled,
    className,
    wrapperClassName,
    children,
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
      <div className={styles.selectWrapper}>
        <select
          {...props}
          ref={ref}
          id={id ?? generatedId}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={cn(ariaDescribedBy, helperTextId) || undefined}
          className={cn(styles.select, focusRingClassName, SIZE_CLASS[size], invalid && styles.fieldInvalid, className)}
        >
          {placeholder ? (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          ) : null}
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <span className={styles.selectChevron} aria-hidden="true">
          <ChevronDownGlyph />
        </span>
      </div>
      {helperText ? (
        <p id={helperTextId} className={cn(styles.fieldHelperText, invalid && styles.fieldHelperTextInvalid)}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
