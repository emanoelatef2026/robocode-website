/**
 * Component Tokens — DSA §5.4.
 *
 * A Component's own reference to the Semantic layer, scoped to that
 * Component's concerns (e.g. `.ds-card`'s border/radius/shadow pointing at
 * `border-soft` rather than a new value). Sprint 1 built Foundation only;
 * Sprint 2 built the Primitive Component Library
 * (`design-system/primitives`), so this registry now carries one entry per
 * shipped Primitive — populated incrementally, never speculatively, per
 * this file's original contract. Each entry names the exact Semantic
 * Token(s) that Primitive's stylesheet (`primitives/primitives.module.css`)
 * resolves through; it does not re-declare CSS, only the token selection a
 * reviewer can check against DSA §5.7 ("no Component may reference a
 * Primitive Token directly, only Semantic").
 */
import type { SemanticColorTokens } from "../semantic/color";
import type { SemanticRadiusTokens } from "../semantic/radius";
import type { SemanticElevationTokens } from "../semantic/elevation";

/** A Component Token file may reference any Semantic token category it needs. */
export interface ComponentTokenContext {
  color: SemanticColorTokens;
  radius: SemanticRadiusTokens;
  elevation: SemanticElevationTokens;
}

export type ComponentTokenSet<T extends Record<string, unknown>> = (
  ctx: ComponentTokenContext
) => T;

function button(ctx: ComponentTokenContext) {
  return {
    primaryBg: ctx.color.brand.accent,
    primaryBgHover: ctx.color.brand.accentSoft,
    primaryText: ctx.color.text.onBrand,
    secondaryBg: ctx.color.brand.primary,
    secondaryBgHover: ctx.color.brand.primaryHover,
    outlineBorder: ctx.color.border.default,
    dangerBg: ctx.color.status.danger.dot,
    dangerBgHover: ctx.color.status.danger.text,
    radius: ctx.radius.adminButton,
  };
}

function label(ctx: ComponentTokenContext) {
  return {
    text: ctx.color.text.secondary,
    disabledText: ctx.color.text.mutedSoft,
    requiredMark: ctx.color.status.danger.dot,
  };
}

function field(ctx: ComponentTokenContext) {
  return {
    bg: ctx.color.bg.card,
    border: ctx.color.border.default,
    borderFocus: ctx.color.brand.accent,
    borderInvalid: ctx.color.status.danger.dot,
    placeholder: ctx.color.text.mutedSoft,
    disabledBg: ctx.color.bg.muted,
    radius: ctx.radius.input,
  };
}

function choiceControl(ctx: ComponentTokenContext) {
  return {
    border: ctx.color.border.default,
    checkedBg: ctx.color.brand.primary,
    checkedFill: ctx.color.text.onBrand,
    focusRing: ctx.color.brand.accent,
    radius: ctx.radius.input,
    pillRadius: ctx.radius.chip,
  };
}

function badge(ctx: ComponentTokenContext) {
  return {
    tones: ctx.color.status,
    radius: ctx.radius.chip,
  };
}

function avatar(ctx: ComponentTokenContext) {
  return {
    fallbackBg: ctx.color.brand.primary,
    fallbackText: ctx.color.text.onBrand,
    statusRing: ctx.color.bg.card,
    radius: ctx.radius.chip,
  };
}

function feedbackSurface(ctx: ComponentTokenContext) {
  return {
    track: ctx.color.bg.muted,
    fill: ctx.color.brand.accent,
    shimmer: ctx.color.border.soft,
  };
}

function tooltip(ctx: ComponentTokenContext) {
  return {
    bg: ctx.color.brand.primary,
    text: ctx.color.text.onBrand,
    radius: ctx.radius.input,
  };
}

function structural(ctx: ComponentTokenContext) {
  return {
    line: ctx.color.border.default,
    lineSoft: ctx.color.border.soft,
  };
}

function scrollArea(ctx: ComponentTokenContext) {
  return {
    thumb: ctx.color.text.mutedSoft,
    border: ctx.color.border.default,
    radius: ctx.radius.card,
  };
}

/** One entry per shipped Primitive (`design-system/primitives`), Sprint 2. */
export const COMPONENT_TOKENS: Record<string, ComponentTokenSet<Record<string, unknown>>> = {
  Button: button,
  IconButton: button,
  Label: label,
  Input: field,
  EmailInput: field,
  PasswordInput: field,
  SearchInput: field,
  NumberInput: field,
  Textarea: field,
  Select: field,
  Checkbox: choiceControl,
  Radio: choiceControl,
  Switch: choiceControl,
  Badge: badge,
  Avatar: avatar,
  Spinner: feedbackSurface,
  Skeleton: feedbackSurface,
  Progress: feedbackSurface,
  LoadingIndicator: feedbackSurface,
  Tooltip: tooltip,
  Divider: structural,
  Separator: structural,
  ScrollArea: scrollArea,
};
