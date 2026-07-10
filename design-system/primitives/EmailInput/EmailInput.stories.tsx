import type { Meta, StoryObj } from "../internal/storybook-types";
import { EmailInput } from "./EmailInput";

const meta: Meta<typeof EmailInput> = {
  title: "Primitives/EmailInput",
  component: EmailInput,
  args: { placeholder: "name@robocodeschools.com" },
};
export default meta;

type Story = StoryObj<typeof EmailInput>;

export const Default: Story = {};
export const Invalid: Story = { args: { invalid: true, helperText: "Enter a valid email address." } };
