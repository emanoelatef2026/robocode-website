import type { Meta, StoryObj } from "../internal/storybook-types";
import { PasswordInput } from "./PasswordInput";

const meta: Meta<typeof PasswordInput> = {
  title: "Primitives/PasswordInput",
  component: PasswordInput,
  args: { placeholder: "Enter your password" },
};
export default meta;

type Story = StoryObj<typeof PasswordInput>;

export const Default: Story = {};
export const Invalid: Story = { args: { invalid: true, helperText: "Must be at least 8 characters." } };
