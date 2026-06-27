export function FormField({ label, value, onChange, type = 'text', placeholder, required }: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  type?:        string
  placeholder?: string
  required?:    boolean
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">
        {label}{required && <span className="text-[#EF4444] ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F] transition"
      />
    </div>
  )
}
