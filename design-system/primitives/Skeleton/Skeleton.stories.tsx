import type { Meta, StoryObj } from "../internal/storybook-types";
import { Skeleton } from "./Skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "Primitives/Skeleton",
  component: Skeleton,
};
export default meta;

type Story = StoryObj<typeof Skeleton>;

export const Text: Story = { args: { variant: "text", width: "12rem" } };
export const Circle: Story = { args: { variant: "circle", width: 40, height: 40 } };
export const Rect: Story = { args: { variant: "rect", width: "100%", height: 120 } };

export const CardSkeleton: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Skeleton variant="circle" width={40} height={40} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>
  ),
};
