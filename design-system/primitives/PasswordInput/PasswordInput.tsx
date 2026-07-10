"use client";

/**
 * `Input` pinned to `type="password"` with a built-in show/hide toggle.
 * The toggle is a real `<button type="button">` (never a clickable icon
 * with no role) so it is Tab-reachable and Enter/Space-operable on its own,
 * per the Keyboard requirement every Primitive carries (§12).
 */
import { forwardRef, useState } from "react";
import { Input, type InputProps } from "../Input/Input";
import { EyeGlyph, EyeOffGlyph } from "../internal/icons";
import { focusRingClassName } from "../../a11y";
import { cn } from "../../utils/cn";
import styles from "../primitives.module.css";

export type PasswordInputProps = Omit<InputProps, "type" | "endAddon">;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { autoComplete = "current-password", ...props },
  ref
) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      ref={ref}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      endAddon={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className={cn(styles.passwordToggleButton, focusRingClassName)}
        >
          {visible ? <EyeOffGlyph /> : <EyeGlyph />}
        </button>
      }
    />
  );
});
