"use client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  level:   "error" | "warning" | "info";
  message: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const STYLES = {
  error: {
    wrap:   "bg-[#FEE2E2] border-[#FECACA]",
    icon:   "text-[#EF4444]",
    text:   "text-[#DC2626]",
    label:  "text-[#EF4444]",
    badge:  "Error",
  },
  warning: {
    wrap:   "bg-[#FFFBEB] border-[#FDE68A]",
    icon:   "text-[#F59E0B]",
    text:   "text-[#B45309]",
    label:  "text-[#F59E0B]",
    badge:  "Warning",
  },
  info: {
    wrap:   "bg-sky-50 border-sky-200",
    icon:   "text-sky-500",
    text:   "text-sky-700",
    label:  "text-sky-600",
    badge:  "Info",
  },
};

function Icon({ level }: { level: ValidationIssue["level"] }) {
  if (level === "error") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  }
  if (level === "warning") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MediaValidationMessageProps {
  issues: ValidationIssue[];
}

export default function MediaValidationMessage({
  issues,
}: MediaValidationMessageProps) {
  if (issues.length === 0) return null;

  return (
    <div className="space-y-2">
      {issues.map((issue, i) => {
        const s = STYLES[issue.level];
        return (
          <div
            key={i}
            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${s.wrap}`}
          >
            <span className={s.icon}>
              <Icon level={issue.level} />
            </span>
            <p className={`text-[12px] leading-snug ${s.text}`}>
              <span className={`font-semibold ${s.label}`}>
                {s.badge}:{" "}
              </span>
              {issue.message}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Validation helpers (reusable across admin pages) ──────────────────────────

export function validateImageFile(file: File): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (file.size > 300_000) {
    issues.push({
      level: "error",
      message: `File is ${(file.size / 1000).toFixed(0)} KB — maximum is 300 KB. Compress before uploading.`,
    });
  } else if (file.size > 200_000) {
    issues.push({
      level: "warning",
      message: `File is ${(file.size / 1000).toFixed(0)} KB — consider compressing to keep pages fast.`,
    });
  }

  if (!["image/webp", "image/png", "image/jpeg"].includes(file.type)) {
    issues.push({
      level: "warning",
      message: "WebP format recommended for best performance.",
    });
  }

  return issues;
}

export function validateGifFile(file: File): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (file.size > 5_000_000) {
    issues.push({
      level: "error",
      message: `File is ${(file.size / 1_000_000).toFixed(1)} MB — maximum is 5 MB. Convert to MP4/WebM for better performance.`,
    });
  } else if (file.size > 3_000_000) {
    issues.push({
      level: "warning",
      message: "Large GIF detected. Consider converting to MP4/WebM to reduce size by ~80%.",
    });
  }

  if (file.type === "image/gif") {
    issues.push({
      level: "info",
      message: "GIF accepted. MP4 or WebM would load faster and look sharper.",
    });
  }

  return issues;
}
