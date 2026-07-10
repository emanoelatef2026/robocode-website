import type { Meta, StoryObj } from "../internal/storybook-types";
import { Textarea } from "./Textarea";

const meta: Meta<typeof Textarea> = {
  title: "Primitives/Textarea",
  component: Textarea,
  args: { placeholder: "Write a note…" },
};
export default meta;

type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};
export const Invalid: Story = { args: { invalid: true, helperText: "A note is required." } };
export const NoResize: Story = { args: { resize: "none" } };
export const Disabled: Story = { args: { disabled: true, value: "Locked content" } };
