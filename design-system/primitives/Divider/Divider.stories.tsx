import type { Meta, StoryObj } from "../internal/storybook-types";
import { Divider } from "./Divider";

const meta: Meta<typeof Divider> = {
  title: "Primitives/Divider",
  component: Divider,
};
export default meta;

type Story = StoryObj<typeof Divider>;

export const Horizontal: Story = {};
export const WithLabel: Story = { args: { label: "OR" } };
export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div style={{ display: "flex", height: 40 }}>
      <span>Left</span>
      <Divider {...args} />
      <span>Right</span>
    </div>
  ),
};
