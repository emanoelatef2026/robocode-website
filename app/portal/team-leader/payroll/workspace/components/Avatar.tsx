export function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
  const cls = size === "md"
    ? "h-10 w-10 text-[14px]"
    : "h-8 w-8 text-[11px]"
  return (
    <div className={`${cls} shrink-0 rounded-full bg-[#0B1F3A] flex items-center justify-center font-bold text-white`}>
      {initials || "?"}
    </div>
  )
}
