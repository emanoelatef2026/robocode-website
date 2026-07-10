import type { Meta, StoryObj } from "../internal/storybook-types";
import { SearchInput } from "./SearchInput";

const meta: Meta<typeof SearchInput> = {
  title: "Primitives/SearchInput",
  component: SearchInput,
  args: { placeholder: "Search students…" },
};
export default meta;

type Story = StoryObj<typeof SearchInput>;

export const Default: Story = {};
export const WithValue: Story = { args: { defaultValue: "Ada" } };
