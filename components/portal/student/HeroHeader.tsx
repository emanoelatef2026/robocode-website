import StatusBadge from '@/components/admin/StatusBadge'
import type { StudentStatus } from '@/types/enums'

// ── Level badge (color-coded per tier) ────────────────────────────────────────
// Extracted from the old dashboard HeroBanner — same tiers/colors, unchanged.

function LevelBadge({ level }: { level: number }) {
  const tiers = [
    { min: 1,  max: 3,  bg: 'bg-[#334155]', text: 'text-slate-200',  label: 'Rookie'   },
    { min: 4,  max: 6,  bg: 'bg-blue-600',   text: 'text-blue-100',   label: 'Explorer' },
    { min: 7,  max: 9,  bg: 'bg-violet-600', text: 'text-violet-100', label: 'Builder'  },
    { min: 10, max: 12, bg: 'bg-[#F59E0B]',  text: 'text-amber-100',  label: 'Expert'   },
    { min: 13, max: 15, bg: 'bg-[#FF8A1F]',  text: 'text-orange-100', label: 'Master'   },
  ]
  const tier = tiers.find(t => level >= t.min && level <= t.max) ?? tiers[0]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tier.bg} ${tier.text}`}>
      ⭐ Lv.{level} {tier.label}
    </span>
  )
}

function StatChip({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-[5px]">
      <span className="text-[14px]">{icon}</span>
      <span className="text-[11px] font-bold text-white">{value}</span>
      <span className="text-[9px] text-white/50">{label}</span>
    </div>
  )
}

interface HeroHeaderProps {
  studentName:        string
  studentCode:        string | null
  branchName:         string | null
  status:             StudentStatus
  totalXp:            number
  currentLevel:       number
  maxLevel:            number
  xpProgressPct:       number
  xpToNextLevel:       number
  currentStreak:       number
  groupRank:           number | null
  isStudentOfWeek:     boolean
  activeCoursesCount:  number
  achievementCount:    number
  badgeCount:          number
  certificatesCount:   number
  competitionsCount:   number
}

export default function HeroHeader({
  studentName, studentCode, branchName, status,
  totalXp, currentLevel, maxLevel, xpProgressPct, xpToNextLevel,
  currentStreak, groupRank, isStudentOfWeek,
  activeCoursesCount, achievementCount, badgeCount, certificatesCount, competitionsCount,
}: HeroHeaderProps) {
  const isMaxLevel = currentLevel >= maxLevel
  const firstName  = studentName.split(' ')[0] || 'Student'
  const initials    = studentName.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'S'

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #16304F 60%, #1E3A5F 100%)' }}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#FF8A1F]/10" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-[#FFD166]/5" />

      <div className="relative px-4 pb-4 pt-4">
        {/* Identity row — who am I */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #FF8A1F, #0B1F3A)' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[18px] font-extrabold leading-tight text-white">
                Hey, {firstName}! 👋
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] text-white/45">
                {studentCode && <span>#{studentCode}</span>}
                {branchName && <span>· {branchName}</span>}
                <StatusBadge status={status} dot />
              </div>
            </div>
          </div>
          <div className="shrink-0">
            {isStudentOfWeek ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F59E0B] px-2.5 py-1 text-[10px] font-extrabold text-[#0B1F3A]">
                🏆 Star of the Week!
              </span>
            ) : (
              <LevelBadge level={currentLevel} />
            )}
          </div>
        </div>

        {/* XP section */}
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-extrabold leading-none text-white" style={{ fontFamily: 'var(--font-orbitron)' }}>
                {totalXp.toLocaleString()}
              </span>
              <span className="text-[12px] font-semibold text-white/50">XP</span>
            </div>
            <span className="text-[10.5px] text-white/50">
              {isMaxLevel ? '🏆 Max Level!' : `${xpToNextLevel.toLocaleString()} XP → Lv.${currentLevel + 1}`}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{ width: `${xpProgressPct}%`, background: 'linear-gradient(90deg, #FF8A1F 0%, #FFD166 100%)' }}
            />
          </div>
        </div>

        {/* Stat chips — what have I achieved, at a glance */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatChip icon="📚" value={activeCoursesCount} label={activeCoursesCount === 1 ? 'course' : 'courses'} />
          <StatChip icon="🔥" value={currentStreak} label="day streak" />
          {groupRank != null && (
            <StatChip icon={groupRank === 1 ? '🥇' : groupRank === 2 ? '🥈' : groupRank === 3 ? '🥉' : '🏆'} value={`#${groupRank}`} label="in group" />
          )}
          {(achievementCount + badgeCount) > 0 && (
            <StatChip icon="🏅" value={achievementCount + badgeCount} label="achievements" />
          )}
          {certificatesCount > 0 && (
            <StatChip icon="📜" value={certificatesCount} label={certificatesCount === 1 ? 'certificate' : 'certificates'} />
          )}
          {competitionsCount > 0 && (
            <StatChip icon="🎖️" value={competitionsCount} label={competitionsCount === 1 ? 'competition' : 'competitions'} />
          )}
        </div>
      </div>
    </div>
  )
}
