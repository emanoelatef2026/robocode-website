"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import styles from "./PublicButton.module.css";

// ── Variants ──────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "navy" | "ghost" | "inverse";
export function publicButtonClass(variant: Variant = "primary", className = "") {
  return `${styles.button} ${styles[variant]} ${className}`;
}

// ── Link button ───────────────────────────────────────────────────────────────

interface ButtonLinkProps extends ComponentPropsWithoutRef<"a"> {
  variant?: Variant;
  href:     string;
  external?: boolean;
}

export function ButtonLink({
  variant = "primary",
  href,
  external,
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  const cls = publicButtonClass(variant, className);

  if (external) {
    return (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
      >
        {children}
      </a>
    );
  }

  return (
    <Link {...props} href={href} className={cls}>
      {children}
    </Link>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: Variant;
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button type="button" className={publicButtonClass(variant, className)} {...props}>
      {children}
    </button>
  );
}
