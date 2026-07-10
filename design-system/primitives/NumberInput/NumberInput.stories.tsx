import type { Meta, StoryObj } from "../internal/storybook-types";
import { NumberInput } from "./NumberInput";

const meta: Meta<typeof NumberInput> = {
  title: "Primitives/NumberInput",
  component: NumberInput,
};
export default meta;

type Story = StoryObj<typeof NumberInput>;

export const Default: Story = { args: { defaultValue: 0 } };
export const WithBounds: Story = { args: { defaultValue: 5, min: 0, max: 10 } };
export const Disabled: Story = { args: { defaultValue: 3, disabled: true } };
