/**
 * Storybook-ready scaffold (Sprint 2, extending the Sprint 1 convention
 * already established in `.storybook/main.ts`/`preview.tsx`). Storybook
 * itself is not yet installed (verified against package.json) — every
 * `*.stories.tsx` file in this catalog imports its `Meta`/`StoryObj` shapes
 * from here instead of `@storybook/react`, so the whole catalog type-checks
 * today. The moment `storybook`/`@storybook/react` is installed, swap this
 * file's re-exports for the real package — no story file needs to change,
 * since these types are already shaped as CSF3-compatible.
 */
import type { ComponentProps, ComponentType, ReactElement } from "react";

export interface Meta<T extends ComponentType<any>> {
  title: string;
  component: T;
  args?: Partial<ComponentProps<T>>;
  parameters?: Record<string, unknown>;
}

export interface StoryObj<T extends ComponentType<any>> {
  args?: Partial<ComponentProps<T>>;
  render?: (args: ComponentProps<T>) => ReactElement;
  parameters?: Record<string, unknown>;
}
