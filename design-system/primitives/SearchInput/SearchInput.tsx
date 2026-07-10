"use client";

/**
 * `Input` pinned to a search affordance: a leading search glyph and a
 * trailing clear button that only appears once there is a value to clear.
 * Distinct from the Search category's `InTableSearchBox`/`GlobalSearchTrigger`
 * (component-library-specification.md §4.10) — this is the Foundation-layer
 * text field those compose from, not the search *behavior*.
 */
import { forwardRef, type ChangeEvent, type KeyboardEvent } from "react";
import { Input, type InputProps } from "../Input/Input";
import { SearchGlyph, CloseGlyph } from "../internal/icons";
import { focusRingClassName } from "../../a11y";
import { useControllableState } from "../internal/use-controllable-state";
import { cn } from "../../utils/cn";
import styles from "../primitives.module.css";

export interface SearchInputProps extends Omit<InputProps, "type" | "startAddon" | "value" | "defaultValue"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Fired when the user presses Enter inside the field. */
  onSearch?: (value: string) => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, defaultValue = "", onValueChange, onSearch, onChange, onKeyDown, endAddon, ...props },
  ref
) {
  const [current, setCurrent] = useControllableState({ value, defaultValue, onChange: onValueChange });

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setCurrent(event.target.value);
    onChange?.(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") onSearch?.(current);
    onKeyDown?.(event);
  }

  return (
    <Input
      {...props}
      ref={ref}
      type="search"
      value={current}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      startAddon={<SearchGlyph />}
      endAddon={
        current ? (
          <>
            <button
              type="button"
              onClick={() => setCurrent("")}
              aria-label="Clear search"
              className={cn(styles.searchClearButton, focusRingClassName)}
            >
              <CloseGlyph />
            </button>
            {endAddon}
          </>
        ) : (
          endAddon
        )
      }
    />
  );
});
