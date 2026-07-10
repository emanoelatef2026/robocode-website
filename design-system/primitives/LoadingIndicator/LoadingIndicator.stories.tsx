import type { Meta, StoryObj } from "../internal/storybook-types";
import { LoadingIndicator } from "./LoadingIndicator";

const meta: Meta<typeof LoadingIndicator> = {
  title: "Primitives/LoadingIndicator",
  component: LoadingIndicator,
};
export default meta;

type Story = StoryObj<typeof LoadingIndicator>;

export const Default: Story = {};
export const CustomLabel: Story = { args: { label: "Fetching students…" } };
export const FullPage: Story = { args: { fullPage: true, label: "Loading dashboard…" } };
