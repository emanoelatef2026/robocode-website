"use client";

/**
 * Tri-state checkbox (checked/unchecked/indeterminate) built on a visually
 * hidden native `<input type="checkbox">` plus a styled sibling box — the
 * native element stays in the tab order and carries all real state/ARIA,
 * so screen readers announce it exactly as a checkbox, no `role` needed.
 */
import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import { visuallyHiddenStyle } from "../../a11y";
import { useControllableState } from "../internal/use-controllable-state";
import type { PrimitiveSize } from "../internal/types";
import { CheckGlyph } from "../internal/icons";
import styles from "../primitives.module.css";

const BOX_SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.checkboxBoxSm,
  md: styles.checkboxBoxMd,
  lg: styles.checkboxBoxLg,
};

const LABEL_SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.choiceLabelSm,
  md: styles.choiceLabelMd,
  lg: styles.choiceLabelLg,
};

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type" | "checked" | "defaultChecked" | "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Renders the mixed/partial state. Purely visual — still reads its `checked` value underneath. */
  indeterminate?: boolean;
  /** @default "md" */
  size?: PrimitiveSize;
  children?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    checked,
    defaultChecked = false,
    onCheckedChange,
    indeterminate = false,
    size = "md",
    disabled,
    className,
    children,
    id,
    ...props
  },
  forwardedRef
) {
  const innerRef = useRef<HTMLInputElement | null>(null);
  const [isChecked, setChecked] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  });
  const generatedId = useId();
  const inputId = id ?? generatedId;

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label htmlFor={inputId} className={cn(styles.choiceRoot, disabled && styles.choiceRootDisabled, className)}>
      <input
        {...props}
        ref={(node) => {
          innerRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        id={inputId}
        type="checkbox"
        checked={isChecked}
        disabled={disabled}
        onChange={(event) => setChecked(event.target.checked)}
        className={styles.choiceInput}
        style={visuallyHiddenStyle}
      />
      <span className={cn(styles.checkboxBox, BOX_SIZE_CLASS[size])} aria-hidden="true">
        <CheckGlyph className={styles.checkboxGlyph} />
      </span>
      {children ? <span className={LABEL_SIZE_CLASS[size]}>{children}</span> : null}
    </label>
  );
});
