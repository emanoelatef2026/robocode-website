'use client'

interface SkeletonRowsProps {
  count?:     number
  className?: string
}

export function SkeletonRows({ count = 3, className = '' }: SkeletonRowsProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-lg bg-[#F1F5F9]" />
      ))}
    </div>
  )
}

interface SkeletonCardProps {
  lines?: number
  className?: string
}

export function SkeletonCard({ lines = 3, className = '' }: SkeletonCardProps) {
  return (
    <div className={`ds-card p-5 ${className}`}>
      <div className="mb-4 h-4 w-1/3 animate-pulse rounded bg-[#F1F5F9]" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded bg-[#F1F5F9]"
            style={{ width: `${70 + (i % 3) * 10}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function SkeletonText({ width = 'w-1/2', className = '' }: { width?: string; className?: string }) {
  return <div className={`h-3 animate-pulse rounded bg-[#F1F5F9] ${width} ${className}`} />
}
