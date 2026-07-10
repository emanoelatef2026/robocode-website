import type { Meta, StoryObj } from "../internal/storybook-types";
import { Progress } from "./Progress";

const meta: Meta<typeof Progress> = {
  title: "Primitives/Progress",
  component: Progress,
};
export default meta;

type Story = StoryObj<typeof Progress>;

export const Default: Story = { args: { value: 40 } };
export const WithLabelAndValue: Story = { args: { value: 65, label: "Uploading roster.csv", showValue: true } };
export const Indeterminate: Story = { args: { indeterminate: true, label: "Preparing export…" } };
export const Small: Story = { args: { value: 50, size: "sm" } };
export const Large: Story = { args: { value: 50, size: "lg" } };
