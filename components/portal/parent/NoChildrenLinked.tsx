// Shared empty state for parent-portal pages when no children are linked yet.
export default function NoChildrenLinked() {
  return (
    <div className="flex min-h-100 items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-semibold text-[#0B1F3A]">No children linked</p>
        <p className="mt-1 text-sm text-[#64748B]">
          Contact your administrator to link your children to this account.
        </p>
      </div>
    </div>
  )
}
