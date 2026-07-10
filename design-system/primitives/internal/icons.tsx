/**
 * Minimal inline glyphs used inside a handful of Primitives (PasswordInput's
 * visibility toggle, SearchInput's search/clear affordances, Select's
 * disclosure chevron, NumberInput's steppers, Checkbox's check mark).
 *
 * The Component Library Specification's Foundation category (§4.1) does not
 * name a standalone `Icon` primitive for this sprint's BUILD list — these
 * glyphs are therefore private implementation detail, not a public export,
 * and stay content-free (`aria-hidden`, `focusable={false}`) since every
 * control that renders one already carries its own accessible name.
 */
import type { SVGProps } from "react";

function glyphProps(props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    width: "1em",
    height: "1em",
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
    ...props,
  };
}

export function CheckGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...glyphProps(props)}>
      <path d="M4 10.5l3.5 3.5L16 6" />
    </svg>
  );
}

export function ChevronDownGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...glyphProps(props)}>
      <path d="M5 7.5l5 5 5-5" />
    </svg>
  );
}

export function SearchGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...glyphProps(props)}>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M16.5 16.5l-3.6-3.6" />
    </svg>
  );
}

export function CloseGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...glyphProps(props)}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function EyeGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...glyphProps(props)}>
      <path d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5-8-5.5-8-5.5z" />
      <circle cx="10" cy="10" r="2.25" />
    </svg>
  );
}

export function EyeOffGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...glyphProps(props)}>
      <path d="M2.5 2.5l15 15" />
      <path d="M9.1 4.6C9.4 4.55 9.7 4.5 10 4.5c5 0 8 5.5 8 5.5a14.6 14.6 0 01-2.9 3.6M6.2 6.2A14.7 14.7 0 002 10s3 5.5 8 5.5c1.1 0 2.1-.2 3-.6" />
      <path d="M8.1 8.1a2.25 2.25 0 003 3" />
    </svg>
  );
}

export function ChevronUpGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...glyphProps(props)}>
      <path d="M5 12.5l5-5 5 5" />
    </svg>
  );
}
