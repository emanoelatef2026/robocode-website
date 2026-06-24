"use client";

import { useFormStatus } from "react-dom";

interface Props {
  label?:       string;
  pendingLabel?: string;
  className?:   string;
  variant?:     "orange" | "primary" | "danger";
}

const VARIANT_CLS = {
  orange:  "ds-btn-orange",
  primary: "ds-btn-primary",
  danger:  "inline-flex items-center gap-2 rounded-[10px] bg-[#DC2626] text-white text-[13px] font-semibold px-4 py-2 border-none cursor-pointer transition hover:bg-[#b91c1c]",
};

export default function SubmitButton({
  label = "Save",
  pendingLabel = "Saving…",
  className = "",
  variant = "orange",
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={[
        VARIANT_CLS[variant],
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {pending && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}
