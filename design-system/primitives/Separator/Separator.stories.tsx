import type { Meta, StoryObj } from "../internal/storybook-types";
import { Separator } from "./Separator";

const meta: Meta<typeof Separator> = {
  title: "Primitives/Separator",
  component: Separator,
};
export default meta;

type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {};
export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div style={{ display: "flex", height: 24, gap: 8 }}>
      <span>Edit</span>
      <Separator {...args} />
      <span>Duplicate</span>
      <Separator {...args} />
      <span>Delete</span>
    </div>
  ),
};
export const Decorative: Story = { args: { decorative: true } };
