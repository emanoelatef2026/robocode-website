import type { Meta, StoryObj } from "../internal/storybook-types";
import { Tooltip } from "./Tooltip";
import { Button } from "../Button/Button";

const meta: Meta<typeof Tooltip> = {
  title: "Primitives/Tooltip",
  component: Tooltip,
  args: { content: "Saves the current group" },
};
export default meta;

type Story = StoryObj<typeof Tooltip>;

export const Default: Story = { render: (args) => <Tooltip {...args}><Button>Save</Button></Tooltip> };
export const Bottom: Story = { args: { placement: "bottom" }, render: (args) => <Tooltip {...args}><Button>Save</Button></Tooltip> };
export const Left: Story = { args: { placement: "left" }, render: (args) => <Tooltip {...args}><Button>Save</Button></Tooltip> };
export const Right: Story = { args: { placement: "right" }, render: (args) => <Tooltip {...args}><Button>Save</Button></Tooltip> };
