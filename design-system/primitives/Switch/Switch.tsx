"use client";

/**
 * Boolean on/off toggle rendered with `role="switch"` semantics (native
 * `<input type="checkbox">` + `role="switch"` — the WAI-ARIA-recommended
 * way to get switch semantics with full native keyboard support intact).
 * Distinct from `Checkbox`: a Switch takes effect immediately, a Checkbox
 * marks a pending selection inside a form.
 */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import { visuallyHiddenStyle } from "../../a11y";
import { useControllableState } from "../internal/use-controllable-state";
import type { PrimitiveSize } from "../internal/types";
import styles from "../primitives.module.css";

const TRACK_SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.switchTrackSm,
  md: styles.switchTrackMd,
  lg: styles.switchTrackLg,
};

const LABEL_SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.choiceLabelSm,
  md: styles.choiceLabelMd,
  lg: styles.choiceLabelLg,
};

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type" | "checked" | "defaultChecked" | "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** @default "md" */
  size?: PrimitiveSize;
  children?: ReactNode;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { checked, defaultChecked = false, onCheckedChange, size = "md", disabled, className, children, id, ...props },
  ref
) {
  const [isChecked, setChecked] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  });
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label htmlFor={inputId} className={cn(styles.choiceRoot, disabled && styles.choiceRootDisabled, className)}>
      <input
        {...props}
        ref={ref}
        id={inputId}
        type="checkbox"
        role="switch"
        checked={isChecked}
        disabled={disabled}
        onChange={(event) => setChecked(event.target.checked)}
        className={styles.choiceInput}
        style={visuallyHiddenStyle}
      />
      <span className={cn(styles.switchTrack, TRACK_SIZE_CLASS[size])} aria-hidden="true">
        <span className={styles.switchThumb} />
      </span>
      {children ? <span className={LABEL_SIZE_CLASS[size]}>{children}</span> : null}
    </label>
  );
});
