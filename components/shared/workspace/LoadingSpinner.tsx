export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const padCls  = size === 'sm' ? 'py-12' : 'py-14'
  const sizeCls = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
  return (
    <div className={`flex items-center justify-center ${padCls}`}>
      <div className={`animate-spin rounded-full border-2 border-[#0E7490] border-t-transparent ${sizeCls}`} />
    </div>
  )
}
