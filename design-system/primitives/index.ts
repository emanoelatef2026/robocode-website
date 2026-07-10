/**
 * Primitive Component Library barrel — Sprint 2.
 *
 * `design-system-architecture.md` §2.2's Foundation category (Button,
 * Input, Icon, Badge, Checkbox, Toggle) built out to the full BUILD list
 * this sprint scoped: irreducible interactive units, no domain awareness,
 * no independent behavior contract. Import from the component's own
 * sub-path (`@/design-system/primitives/Button`) where possible — this
 * root barrel is provided for convenience and stays tree-shakable because
 * every export below is named, never a default or a side-effecting module.
 */

export * from "./Button";
export * from "./IconButton";
export * from "./Label";
export * from "./Input";
export * from "./EmailInput";
export * from "./PasswordInput";
export * from "./SearchInput";
export * from "./NumberInput";
export * from "./Textarea";
export * from "./Select";
export * from "./Checkbox";
export * from "./Radio";
export * from "./Switch";
export * from "./Badge";
export * from "./Avatar";
export * from "./Spinner";
export * from "./Skeleton";
export * from "./Tooltip";
export * from "./Divider";
export * from "./Separator";
export * from "./ScrollArea";
export * from "./Progress";
export * from "./LoadingIndicator";
