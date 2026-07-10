import type { Meta, StoryObj } from "../internal/storybook-types";
import { ScrollArea } from "./ScrollArea";

const meta: Meta<typeof ScrollArea> = {
  title: "Primitives/ScrollArea",
  component: ScrollArea,
  args: { "aria-label": "Student list", maxHeight: 160, bordered: true },
};
export default meta;

type Story = StoryObj<typeof ScrollArea>;

export const Default: Story = {
  render: (args) => (
    <ScrollArea {...args}>
      <ul style={{ margin: 0, padding: 12 }}>
        {Array.from({ length: 20 }, (_, i) => (
          <li key={i}>Student {i + 1}</li>
        ))}
      </ul>
    </ScrollArea>
  ),
};

export const Horizontal: Story = {
  args: { axis: "horizontal", maxHeight: undefined },
  render: (args) => (
    <ScrollArea {...args} style={{ width: 240 }}>
      <div style={{ display: "flex", gap: 8, padding: 12 }}>
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} style={{ padding: 8, background: "#eee" }}>
            Item {i + 1}
          </span>
        ))}
      </div>
    </ScrollArea>
  ),
};
