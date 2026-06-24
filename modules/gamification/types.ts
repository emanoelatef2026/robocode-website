// ─── Level thresholds ─────────────────────────────────────────────────────────
// XP required to REACH each level (index = level - 1)
// Grows ~40% per level with mild acceleration

export const LEVEL_THRESHOLDS = [
  0,      // Level 1
  500,    // Level 2
  1000,   // Level 3
  1800,   // Level 4
  2800,   // Level 5
  4000,   // Level 6
  5500,   // Level 7
  7200,   // Level 8
  9200,   // Level 9
  11500,  // Level 10
  14000,  // Level 11
  17000,  // Level 12
  20500,  // Level 13
  24500,  // Level 14
  29000,  // Level 15
] as const

export const MAX_LEVEL = LEVEL_THRESHOLDS.length

// ─── XP award amounts ─────────────────────────────────────────────────────────

export const XP_AWARDS = {
  ATTENDANCE_PRESENT:       25,
  ATTENDANCE_LATE:          10,
  ASSIGNMENT_SUBMITTED:     40,
  ASSIGNMENT_EXCELLENT:     60,   // when score >= 90% of max_score
  PORTFOLIO_PROJECT:        100,
  CERTIFICATE_EARNED:       200,
  VIDEO_CHALLENGE:          150,  // project with a valid video_url
  STUDENT_OF_THE_WEEK:      250,
  PERFECT_ATTENDANCE_BONUS: 50,   // awarded when attendance this session = 100%
} as const

// ─── Achievement definitions ──────────────────────────────────────────────────
// title must match what gets stored in student_achievements.title
// The service checks if the title already exists before inserting.

export interface AchievementDef {
  title: string
  description: string
  type: 'project' | 'competition' | 'certificate' | 'leadership' | 'attendance' | 'innovation' | 'custom'
  xpReward: number
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // Attendance
  { title: 'First Attendance',       description: 'Attended your first session.',                       type: 'attendance',  xpReward: 25  },
  { title: 'Perfect Attendance',     description: 'Achieved 100% attendance in your group.',           type: 'attendance',  xpReward: 100 },
  // Assignments
  { title: 'First Assignment',       description: 'Submitted your first assignment.',                   type: 'custom',      xpReward: 25  },
  // Portfolio
  { title: 'First Project',          description: 'Added your first portfolio project.',                type: 'project',     xpReward: 50  },
  { title: '5 Projects',             description: 'Added 5 portfolio projects.',                        type: 'project',     xpReward: 100 },
  { title: '10 Projects',            description: 'Added 10 portfolio projects. Impressive!',           type: 'project',     xpReward: 200 },
  // Videos (creator)
  { title: 'First Video',            description: 'Shared your first project video.',                   type: 'innovation',  xpReward: 75  },
  { title: '5 Videos',               description: 'Shared 5 project videos. You\'re a creator!',       type: 'innovation',  xpReward: 150 },
  { title: '10 Videos',              description: 'Shared 10 project videos. Creator milestone!',       type: 'innovation',  xpReward: 250 },
  { title: '25 Videos',              description: 'Shared 25 project videos. Video Master!',             type: 'innovation',  xpReward: 500 },
  // XP milestones
  { title: '1000 XP',               description: 'Earned 1,000 total XP.',                             type: 'custom',      xpReward: 0   },
  { title: '5000 XP',               description: 'Earned 5,000 total XP. Power learner!',              type: 'custom',      xpReward: 0   },
  { title: '10000 XP',              description: 'Earned 10,000 total XP. Elite student!',             type: 'custom',      xpReward: 0   },
  // Certificate
  { title: 'First Certificate',      description: 'Earned your first certificate.',                     type: 'certificate', xpReward: 0   },
  // Specializations
  { title: 'Python Explorer',        description: 'Completed a Python course.',                         type: 'project',     xpReward: 50  },
  { title: 'AI Explorer',            description: 'Completed an AI course.',                            type: 'project',     xpReward: 50  },
  { title: 'Robotics Builder',       description: 'Completed a Robotics course.',                       type: 'project',     xpReward: 50  },
  { title: 'Game Developer',         description: 'Completed a Game Development course.',               type: 'project',     xpReward: 50  },
]

// ─── Badge definitions ────────────────────────────────────────────────────────

export interface BadgeDef {
  badge_name: string
  description: string
  condition: 'level_5' | 'level_10' | 'streak_7' | 'streak_30' | 'videos_5' | 'videos_25' | 'projects_10' | 'xp_1000' | 'xp_5000' | 'certificates_1'
}

export const BADGE_DEFS: BadgeDef[] = [
  { badge_name: '🏆 Champion',          description: 'Reached Level 10.',                   condition: 'level_10'      },
  { badge_name: '🔥 Consistent Learner',description: '7-day activity streak.',              condition: 'streak_7'      },
  { badge_name: '🚀 Innovator',          description: 'Earned 1,000 XP.',                   condition: 'xp_1000'       },
  { badge_name: '🎥 Creator',            description: 'Shared 5 project videos.',            condition: 'videos_5'      },
  { badge_name: '🎬 Video Master',       description: 'Shared 25 project videos.',           condition: 'videos_25'     },
  { badge_name: '💡 Builder',            description: 'Completed 10 portfolio projects.',    condition: 'projects_10'   },
  { badge_name: '⭐ Power Learner',      description: 'Earned 5,000 XP.',                   condition: 'xp_5000'       },
  { badge_name: '📜 Graduate',           description: 'Earned your first certificate.',      condition: 'certificates_1'},
  { badge_name: '🔥 Dedicated',          description: '30-day activity streak.',             condition: 'streak_30'     },
  { badge_name: '🥇 Level 5',            description: 'Reached Level 5.',                   condition: 'level_5'       },
]

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface XPProgress {
  level:        number
  totalXp:      number
  levelStartXp: number
  nextLevelXp:  number
  currentXp:    number  // XP earned within this level
  progressPct:  number  // 0–100
}

export interface StudentGameProfile {
  totalXp:           number
  currentLevel:      number
  currentStreak:     number
  bestStreak:        number
  lastActivityDate:  string | null
  progress:          XPProgress
}

export interface LeaderboardEntry {
  rank:          number
  student_id:    string
  student_name:  string
  total_xp:      number
  current_level: number
  project_count: number
  is_self:       boolean
}

export interface StudentOfWeek {
  student_id:   string
  student_name: string
  weekly_xp:    number
  group_id:     string
  group_name:   string
}
