import type { Meta, StoryObj } from "../internal/storybook-types";
import { Label } from "./Label";

const meta: Meta<typeof Label> = {
  title: "Primitives/Label",
  component: Label,
  args: { children: "Field label", htmlFor: "example-field" },
};
export default meta;

type Story = StoryObj<typeof Label>;

export const Default: Story = {};
export const Required: Story = { args: { required: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
