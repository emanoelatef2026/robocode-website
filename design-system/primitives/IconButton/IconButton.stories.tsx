import type { Meta, StoryObj } from "../internal/storybook-types";
import { IconButton } from "./IconButton";
import { CloseGlyph } from "../internal/icons";

const meta: Meta<typeof IconButton> = {
  title: "Primitives/IconButton",
  component: IconButton,
  args: { label: "Close", icon: <CloseGlyph /> },
};
export default meta;

type Story = StoryObj<typeof IconButton>;

export const Default: Story = {};
export const Primary: Story = { args: { variant: "primary" } };
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const Loading: Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true } };
