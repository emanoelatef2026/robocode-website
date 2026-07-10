import type { Meta, StoryObj } from "../internal/storybook-types";
import { Badge, BADGE_TONES } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Primitives/Badge",
  component: Badge,
  args: { children: "Badge" },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
export const WithDot: Story = { args: { dot: true, tone: "success", children: "Active" } };
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };

export const AllTones: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {BADGE_TONES.map((tone) => (
        <Badge key={tone} {...args} tone={tone}>
          {tone}
        </Badge>
      ))}
    </div>
  ),
};
