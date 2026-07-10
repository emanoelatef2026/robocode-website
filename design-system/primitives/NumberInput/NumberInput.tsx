"use client";

/**
 * `Input` pinned to `type="number"` with visible increment/decrement
 * steppers. The native input already supports ArrowUp/ArrowDown per
 * blueprint's keyboard-operability rule — the steppers are an additional,
 * pointer/touch-friendly path, never the only one.
 */
import { forwardRef, type ChangeEvent } from "react";
import { Input, type InputProps } from "../Input/Input";
import { ChevronUpGlyph, ChevronDownGlyph } from "../internal/icons";
import { useControllableState } from "../internal/use-controllable-state";
import styles from "../primitives.module.css";

export interface NumberInputProps extends Omit<InputProps, "type" | "endAddon" | "value" | "defaultValue" | "onChange"> {
  value?: number | "";
  defaultValue?: number | "";
  onValueChange?: (value: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, defaultValue = "", onValueChange, min, max, step = 1, disabled, ...props },
  ref
) {
  const [current, setCurrent] = useControllableState<number | "">({
    value,
    defaultValue,
    onChange: onValueChange,
  });

  function clamp(next: number): number {
    let result = next;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    setCurrent(raw === "" ? "" : Number(raw));
  }

  function increment() {
    setCurrent(clamp((typeof current === "number" ? current : 0) + step));
  }

  function decrement() {
    setCurrent(clamp((typeof current === "number" ? current : 0) - step));
  }

  const atMax = typeof current === "number" && max !== undefined && current >= max;
  const atMin = typeof current === "number" && min !== undefined && current <= min;

  return (
    <Input
      {...props}
      ref={ref}
      type="number"
      inputMode="numeric"
      value={current}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={handleChange}
      endAddon={
        // tabIndex={-1}/aria-hidden: pointer/touch-only affordance — the
        // focused input already exposes the same increment/decrement via
        // ArrowUp/ArrowDown, so these are not a second, undiscoverable
        // keyboard path (component-library-specification.md §12 Keyboard).
        <span className={styles.numberStepper}>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={styles.numberStepperButton}
            disabled={disabled || atMax}
            onClick={increment}
          >
            <ChevronUpGlyph />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={styles.numberStepperButton}
            disabled={disabled || atMin}
            onClick={decrement}
          >
            <ChevronDownGlyph />
          </button>
        </span>
      }
    />
  );
});
