import type { Meta, StoryObj } from "../internal/storybook-types";
import { Radio } from "./Radio";

const meta: Meta<typeof Radio> = {
  title: "Primitives/Radio",
  component: Radio,
  args: { name: "plan" },
};
export default meta;

type Story = StoryObj<typeof Radio>;

export const Default: Story = { args: { children: "Monthly", value: "monthly" } };
export const Checked: Story = { args: { children: "Yearly", value: "yearly", defaultChecked: true } };
export const Disabled: Story = { args: { children: "Unavailable", value: "trial", disabled: true } };

export const Group: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Radio {...args} value="monthly" defaultChecked>
        Monthly
      </Radio>
      <Radio {...args} value="yearly">
        Yearly
      </Radio>
    </div>
  ),
};
