interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: "cyan" | "orange" | "green" | "purple";
}

const ACCENT = {
  cyan:   { bg: "bg-[#19C6F4]/10", text: "text-[#19C6F4]" },
  orange: { bg: "bg-orange-50",    text: "text-orange-500" },
  green:  { bg: "bg-[#E7F8EE]",   text: "text-emerald-500" },
  purple: { bg: "bg-violet-50",    text: "text-violet-500" },
};

export default function StatCard({ label, value, icon, accent = "cyan" }: StatCardProps) {
  const { bg, text } = ACCENT[accent];
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-[#9CA3AF]">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg} ${text}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold text-[#0B132B]">{value}</p>
    </div>
  );
}
