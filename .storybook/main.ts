/**
 * Storybook-ready scaffold (SPRINT 1 — Design System Foundation).
 *
 * Storybook is not yet installed (verified against package.json). This
 * file is dependency-free, valid TypeScript config data — it type-checks
 * today and becomes load-bearing the moment
 * `npm i -D storybook @storybook/nextjs @storybook/addon-essentials
 * @storybook/addon-a11y` is run and `StorybookMainConfig` below is swapped
 * for the real `StorybookConfig` type from `@storybook/nextjs`. No other
 * change should be required at that point.
 */

interface StorybookMainConfig {
  stories: string[];
  addons: string[];
  framework: { name: string; options: Record<string, unknown> };
  staticDirs?: string[];
  typescript?: { reactDocgen: string };
}

const config: StorybookMainConfig = {
  stories: [
    "../design-system/**/*.stories.@(ts|tsx)",
    "../components/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  staticDirs: ["../public"],
  typescript: { reactDocgen: "react-docgen-typescript" },
};

export default config;
