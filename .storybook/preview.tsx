/**
 * Storybook-ready scaffold (SPRINT 1 — Design System Foundation).
 *
 * Wraps every story in `DesignSystemProvider` so Theme Tokens (light/dark)
 * are available to any future Primitive/Pattern/Component story. Inert
 * until Storybook itself is installed — see `.storybook/main.ts`.
 */
import type { ReactNode } from "react";
import { DesignSystemProvider } from "../design-system/providers";
import "../app/globals.css";

interface StorybookPreview {
  decorators: Array<(Story: () => ReactNode) => ReactNode>;
  parameters: Record<string, unknown>;
}

const preview: StorybookPreview = {
  decorators: [
    (Story) => (
      <DesignSystemProvider>
        <Story />
      </DesignSystemProvider>
    ),
  ],
  parameters: {
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#F8FAFC" },
        { name: "dark", value: "#0A1526" },
      ],
    },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
};

export default preview;
