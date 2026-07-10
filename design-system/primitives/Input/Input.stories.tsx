import type { Meta, StoryObj } from "../internal/storybook-types";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Primitives/Input",
  component: Input,
  args: { placeholder: "Type here…" },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const Invalid: Story = { args: { invalid: true, helperText: "This field is required." } };
export const WithHelperText: Story = { args: { helperText: "We'll never share this." } };
export const Disabled: Story = { args: { disabled: true, value: "Read-only value" } };
