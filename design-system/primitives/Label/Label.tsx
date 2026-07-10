/**
 * Field label. Pairs with any Data Entry Primitive via native `htmlFor`/`id`
 * association — the accessible-name mechanism every field in this catalog
 * relies on instead of `aria-label` (component-library-specification.md
 * §12, "Semantic HTML first").
 */
import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import type { PrimitiveSize } from "../internal/types";
import styles from "../primitives.module.css";

const SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.labelSm,
  md: styles.labelMd,
  lg: styles.labelLg,
};

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** @default "md" */
  size?: PrimitiveSize;
  /** Renders a "*" marker and adds an accessible "required" hint. */
  required?: boolean;
  /** Visually mutes the label to match a disabled field it describes. */
  disabled?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { size = "md", required = false, disabled = false, className, children, ...props },
  ref
) {
  return (
    <label
      {...props}
      ref={ref}
      className={cn(styles.label, SIZE_CLASS[size], disabled && styles.labelDisabled, className)}
    >
      {children}
      {required ? (
        <span className={styles.labelRequiredMark} aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
});
