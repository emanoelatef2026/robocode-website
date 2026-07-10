import type { Meta, StoryObj } from "../internal/storybook-types";
import { Select } from "./Select";

const BRANCH_OPTIONS = [
  { value: "cairo", label: "Cairo" },
  { value: "giza", label: "Giza" },
  { value: "alex", label: "Alexandria" },
];

const meta: Meta<typeof Select> = {
  title: "Primitives/Select",
  component: Select,
  args: { options: BRANCH_OPTIONS, placeholder: "Select a branch" },
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {};
export const Invalid: Story = { args: { invalid: true, helperText: "Choose a branch." } };
export const Disabled: Story = { args: { disabled: true } };
