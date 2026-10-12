type Badge = { id: string; badge_name: string; description: string | null };

export default function RecognitionBadges({
  badges,
  audience,
}: {
  badges: Badge[];
  audience: "student" | "parent";
}) {
  if (!badges.length) return null;
  return (
    <section className="rounded-2xl border border-[#D7E0EA] bg-white p-5">
      <h2 className="text-base font-bold text-[#0B1F3A]">
        {audience === "student" ? "Your recognition" : "Recognition earned"}
      </h2>
      <p className="mt-1 text-sm text-[#475569]">
        Badges celebrate real effort and learning milestones.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className="flex items-start gap-2 rounded-xl border border-[#F5D5BE] bg-[#FFF7ED] px-3 py-2"
          >
            <span className="text-lg" aria-hidden>
              {badge.badge_name.split(" ")[0]}
            </span>
            <div>
              <p className="text-sm font-bold text-[#0B1F3A]">
                {badge.badge_name.replace(/^\S+\s/, "")}
              </p>
              {badge.description && (
                <p className="max-w-xs text-xs text-[#475569]">
                  {badge.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
