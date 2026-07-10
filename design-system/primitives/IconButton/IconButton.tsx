"use client";

/**
 * Icon-only Button. `label` is mandatory, not optional — an icon-only
 * control with no accessible name is a hard accessibility failure
 * (component-library-specification.md §12 "Screen Readers": "every
 * icon-only control carries an accessible label").
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import { focusRingClassName } from "../../a11y";
import type { PrimitiveSize } from "../internal/types";
import { Spinner } from "../Spinner/Spinner";
import { type ButtonVariant, BUTTON_VARIANTS } from "../Button/Button";
import styles from "../primitives.module.css";

export { BUTTON_VARIANTS };

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.btnPrimary,
  secondary: styles.btnSecondary,
  outline: styles.btnOutline,
  ghost: styles.btnGhost,
  danger: styles.btnDanger,
};

const SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.iconBtnSm,
  md: styles.iconBtnMd,
  lg: styles.iconBtnLg,
};

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Accessible name — required, since this control carries no visible text. */
  label: string;
  icon: ReactNode;
  /** @default "ghost" */
  variant?: ButtonVariant;
  /** @default "md" */
  size?: PrimitiveSize;
  loading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = "ghost", size = "md", loading = false, disabled, className, type = "button", ...props },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-label={label}
      aria-busy={loading || undefined}
      title={props.title ?? label}
      className={cn(styles.iconBtn, focusRingClassName, VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
    >
      {loading ? <Spinner size={size === "lg" ? "md" : "sm"} label="" /> : icon}
    </button>
  );
});
