import type { Meta, StoryObj } from "../internal/storybook-types";
import { Avatar } from "./Avatar";

const meta: Meta<typeof Avatar> = {
  title: "Primitives/Avatar",
  component: Avatar,
  args: { name: "Ada Lovelace" },
};
export default meta;

type Story = StoryObj<typeof Avatar>;

export const Initials: Story = {};
export const WithImage: Story = { args: { src: "https://i.pravatar.cc/128" } };
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const OnlineStatus: Story = { args: { status: "online" } };
export const BusyStatus: Story = { args: { status: "busy" } };
