"use client";

/**
 * The single Button primitive every other Button-shaped control in the
 * catalog composes from (IconButton, and — outside this sprint's scope —
 * any future business-component action). Foundation category, §4.1.
 */
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import { focusRingClassName } from "../../a11y";
import type { PrimitiveSize } from "../internal/types";
import { Spinner } from "../Spinner/Spinner";
import styles from "../primitives.module.css";

export const BUTTON_VARIANTS = ["primary", "secondary", "outline", "ghost", "danger"] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.btnPrimary,
  secondary: styles.btnSecondary,
  outline: styles.btnOutline,
  ghost: styles.btnGhost,
  danger: styles.btnDanger,
};

const SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.btnSm,
  md: styles.btnMd,
  lg: styles.btnLg,
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** @default "primary" */
  variant?: ButtonVariant;
  /** @default "md" */
  size?: PrimitiveSize;
  /** Shows a Spinner in place of the label and blocks interaction, without changing the button's width. */
  loading?: boolean;
  /** Content announced instead of `children` while `loading` is true. @default "Loading" */
  loadingLabel?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * Primary interactive action control. Fully keyboard-operable via native
 * `<button>` semantics (Space/Enter activate, Tab focuses) — no ARIA role
 * needed (component-library-specification.md §12, "Semantic HTML first").
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    loadingLabel = "Loading",
    leftIcon,
    rightIcon,
    fullWidth = false,
    disabled,
    className,
    children,
    type = "button",
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        styles.btn,
        focusRingClassName,
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        fullWidth && styles.btnFullWidth,
        loading && styles.btnLoading,
        className
      )}
    >
      {loading ? (
        <span className={styles.btnSpinner}>
          <Spinner size={size === "lg" ? "md" : "sm"} label={loadingLabel} />
        </span>
      ) : (
        leftIcon
      )}
      {children}
      {!loading ? rightIcon : null}
    </button>
  );
});
