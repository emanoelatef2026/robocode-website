import Image from "next/image"

/**
 * The one logo mark used across every portal. Sizing/spacing/typography is
 * taken verbatim from the Student portal's sidebar logo — the design the
 * Layout System Unification sprint designated as the reference implementation.
 */
export function PortalLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex shrink-0 items-center gap-[9px] px-2 pb-5 pt-[18px] ${className}`}>
      <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-white">
        <Image src="/logo.png" alt="Robocode" width={23} height={23} className="h-[23px] w-[23px] object-contain" />
      </div>
      <span
        className="text-[12px] font-bold tracking-[.04em] text-white"
        style={{ fontFamily: "var(--font-orbitron)" }}
      >
        ROBOCODE
      </span>
    </div>
  )
}
