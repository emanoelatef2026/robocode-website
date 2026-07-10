"use client";

/**
 * Shared controlled/uncontrolled state contract for every Primitive that
 * accepts both a `value`/`onChange` pair (controlled) and a
 * `defaultValue` (uncontrolled) — Checkbox, Radio, Switch, Select,
 * SearchInput, NumberInput. Written once here so no Primitive re-derives
 * this logic (Sprint 2 review gate: "No duplicated logic").
 */
import { useCallback, useInsertionEffect, useRef, useState } from "react";

export interface UseControllableStateProps<T> {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}

export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: UseControllableStateProps<T>): [T, (next: T) => void] {
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const current = isControlled ? (value as T) : uncontrolled;

  // useInsertionEffect (not a plain render-time assignment) keeps this
  // "latest callback" ref update out of render, satisfying React Compiler
  // purity, while still committing before any effect could read a stale
  // value (React docs' recommended pattern for custom-hook event callbacks).
  const onChangeRef = useRef(onChange);
  useInsertionEffect(() => {
    onChangeRef.current = onChange;
  });

  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) setUncontrolled(next);
      onChangeRef.current?.(next);
    },
    [isControlled]
  );

  return [current, setValue];
}
