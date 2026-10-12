"use client";

import { useEffect, useMemo, useState } from "react";
import {
  awardCenterRecognition,
  loadGroupEvaluations,
  saveCenterEvaluation,
} from "@/modules/student-evaluations/center-actions";
import {
  SESSION_CRITERIA,
  type CenterItem,
  type EvaluationSource,
  type GroupEvaluationData,
} from "@/modules/student-evaluations/center";

type Group = {
  id: string;
  name: string;
  code: string | null;
  course: string;
  branch: string;
  day: string | null;
  studentCount: number;
  completedSessions: number;
};
type Tab = EvaluationSource;
const TABS: { id: Tab; label: string }[] = [
  { id: "session", label: "Sessions" },
  { id: "assignment", label: "Assignments" },
  { id: "video", label: "Videos" },
  { id: "project", label: "Projects" },
];
const control =
  "min-h-11 w-full rounded-xl border border-[#D7E0EA] bg-white px-3 py-2 text-sm font-semibold text-[#0B1F3A] outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#10B6D3]/20";
const DAY_ORDER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const dayLabel = (day: string | null) =>
  day ? `${day.slice(0, 1).toUpperCase()}${day.slice(1)}` : "No day set";

function Stars({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} stars`}
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          className={`rounded-lg px-1 py-0.5 text-3xl leading-none transition hover:scale-110 ${n <= (value ?? 0) ? "text-[#C2410C]" : "text-[#B8C5D6]"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

const RECOGNITION_BADGES = ['💡 Creative Thinker', '🤝 Team Player', '🚀 Persistent Learner'] as const

function RecognitionPanel({ groupId, studentId }: { groupId: string; studentId: string }) {
  const [badge, setBadge] = useState<(typeof RECOGNITION_BADGES)[number]>(RECOGNITION_BADGES[0])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function award() {
    setBusy(true)
    setMessage('')
    const result = await awardCenterRecognition({ group_id: groupId, student_id: studentId, badge_name: badge })
    setMessage(result.success ? 'Badge awarded. The student can see it in Achievements.' : result.error)
    setBusy(false)
  }
  return <div className="mt-4 border-t border-[#E2E8F0] pt-4">
    <p className="text-sm font-bold text-[#0B1F3A]">Recognize effort</p>
    <p className="mt-1 text-xs leading-relaxed text-[#64748B]">Award one lasting badge for a real strength. Each badge can be earned once.</p>
    <select aria-label="Recognition badge" className={`${control} mt-3`} value={badge} onChange={event => setBadge(event.target.value as typeof badge)}>{RECOGNITION_BADGES.map(value => <option key={value} value={value}>{value}</option>)}</select>
    <button type="button" disabled={busy || !studentId} onClick={award} className="mt-2 min-h-10 w-full rounded-xl bg-[#0E7490] px-3 text-sm font-bold text-white hover:bg-[#0A5B71] disabled:opacity-50">{busy ? 'Awarding…' : 'Award badge'}</button>
    {message && <p role="status" className="mt-2 text-xs font-semibold text-[#334155]">{message}</p>}
  </div>
}

function Editor({
  data,
  studentId,
  source,
  sourceId,
  criterion,
  onSaved,
}: {
  data: GroupEvaluationData;
  studentId: string;
  source: EvaluationSource;
  sourceId: string;
  criterion: string;
  onSaved: (data: GroupEvaluationData) => void;
}) {
  const existing = data.evaluations.find(
    (e) =>
      e.student_id === studentId &&
      e.criterion === criterion &&
      (source === "session"
        ? e.schedule_id === sourceId
        : e.source_type === source && e.source_id === sourceId),
  );
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [score, setScore] = useState<string>(
    existing?.score == null ? "" : String(existing.score),
  );
  const [feedback, setFeedback] = useState(existing?.feedback ?? "");
  const [nextGoal, setNextGoal] = useState(existing?.next_goal ?? "");
  const [showStudent, setShowStudent] = useState(
    existing?.visible_to_student || existing?.visible_to_parent
      ? existing.visible_to_student
      : true,
  );
  const [showParent, setShowParent] = useState(
    existing?.visible_to_student || existing?.visible_to_parent
      ? existing.visible_to_parent
      : true,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(publish: boolean) {
    setMessage("");
    setSaving(true);
    const result = await saveCenterEvaluation({
      group_id: data.group_id,
      student_id: studentId,
      source,
      source_id: sourceId,
      criterion,
      rating,
      score: score.trim() === "" ? null : Number(score),
      feedback: feedback.trim() || null,
      next_goal: nextGoal.trim() || null,
      publish,
      visible_to_student: showStudent,
      visible_to_parent: showParent,
    });
    if (!result.success) {
      setMessage(result.error);
      setSaving(false);
      return;
    }
    const refreshed = await loadGroupEvaluations(data.group_id);
    if (refreshed.success) {
      onSaved(refreshed.data);
      setMessage(
        publish ? "Published for the selected audience." : "Draft saved.",
      );
    } else setMessage(`Saved, but could not refresh: ${refreshed.error}`);
    setSaving(false);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[#D7E0EA] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[#0B1F3A]">
            {source === "session"
              ? SESSION_CRITERIA.find((c) => c.key === criterion)?.label
              : `${source[0].toUpperCase()}${source.slice(1)} evaluation`}
          </p>
          <p className="text-xs font-medium text-[#64748B]">
            {existing ? "Edit this evaluation any time" : "New evaluation"}
          </p>
        </div>
        {existing && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${existing.visible_to_student || existing.visible_to_parent ? "bg-[#E7F8EE] text-[#166534]" : "bg-[#F1F5F9] text-[#475569]"}`}
          >
            {existing.visible_to_student || existing.visible_to_parent
              ? "Published"
              : "Draft"}
          </span>
        )}
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold text-[#0B1F3A]">Stars</p>
        <Stars value={rating} onChange={setRating} />
      </div>
      <label className="block text-sm font-semibold text-[#0B1F3A]">
        Score out of 100{" "}
        <span className="font-normal text-[#64748B]">(optional)</span>
        <input
          className={`${control} mt-1`}
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="e.g. 85"
        />
      </label>
      <label className="block text-sm font-semibold text-[#0B1F3A]">
        What went well / what to work on
        <textarea
          className={`${control} mt-1 min-h-24 resize-y`}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          maxLength={2000}
          placeholder="A short, encouraging note for the student"
        />
      </label>
      <label className="block text-sm font-semibold text-[#0B1F3A]">
        Next goal
        <input
          className={`${control} mt-1`}
          value={nextGoal}
          onChange={(e) => setNextGoal(e.target.value)}
          maxLength={500}
          placeholder="One clear goal for the next session"
        />
        <span className="mt-1 block text-xs font-medium text-[#64748B]">Give the student one small action they can try next. It appears as their next goal and on the parent progress view when published.</span>
      </label>
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-[#0B1F3A]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showStudent}
            onChange={(e) => setShowStudent(e.target.checked)}
          />{" "}
          Show student
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showParent}
            onChange={(e) => setShowParent(e.target.checked)}
          />{" "}
          Show parent
        </label>
      </div>
      {message && (
        <p
          role="status"
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${message.includes("saved") || message.includes("Published") ? "bg-[#E7F8EE] text-[#166534]" : "bg-[#FEF2F2] text-[#B91C1C]"}`}
        >
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={saving || (rating === null && !score)}
          onClick={() => save(false)}
          className="min-h-11 flex-1 rounded-xl border border-[#D7E0EA] px-4 text-sm font-bold text-[#0B1F3A] hover:bg-[#F1F5F9] disabled:opacity-50"
        >
          {existing?.visible_to_student || existing?.visible_to_parent
            ? "Unpublish to draft"
            : "Save draft"}
        </button>
        <button
          disabled={
            saving ||
            (rating === null && !score) ||
            (!showStudent && !showParent)
          }
          onClick={() => save(true)}
          className="min-h-11 flex-1 rounded-xl bg-[#C2410C] px-4 text-sm font-bold text-white hover:bg-[#9A3412] disabled:opacity-50"
        >
          {saving
            ? "Saving…"
            : existing?.visible_to_student || existing?.visible_to_parent
              ? "Update published"
              : "Publish evaluation"}
        </button>
      </div>
    </div>
  );
}

function Workspace({
  data,
  onClose,
  onChange,
}: {
  data: GroupEvaluationData;
  onClose: () => void;
  onChange: (d: GroupEvaluationData) => void;
}) {
  const [tab, setTab] = useState<Tab>("session");
  const [studentId, setStudentId] = useState(data.students[0]?.id ?? "");
  const [sessionId, setSessionId] = useState(data.sessions[0]?.id ?? "");
  const [criterion, setCriterion] = useState<string>(SESSION_CRITERIA[0].key);
  const [itemId, setItemId] = useState("");
  const student = data.students.find((s) => s.id === studentId);
  const items =
    tab === "assignment"
      ? data.assignments
      : tab === "video"
        ? data.videos
        : data.projects;
  const studentItems = items.filter((i) => i.student_id === studentId);
  const currentId =
    tab === "session"
      ? sessionId
      : studentItems.some((i) => i.id === itemId)
        ? itemId
        : (studentItems[0]?.id ?? "");
  const selectedItem = studentItems.find((i) => i.id === currentId);
  const evaluatedCount = data.students.filter((s) =>
    data.evaluations.some(
      (e) => e.student_id === s.id && e.schedule_id === sessionId,
    ),
  ).length;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="ds-modal-backdrop fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${data.group_name} evaluations`}
        className="flex h-[min(92dvh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#D7E0EA] bg-[#F6F8FB] shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#D7E0EA] bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-[#0B1F3A]">
              {data.group_name}
            </h2>
            <p className="text-xs font-semibold text-[#64748B]">
              {data.students.length} students · {data.sessions.length} sessions
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close evaluations"
            className="rounded-xl border border-[#D7E0EA] px-3 py-2 text-xl text-[#0B1F3A] hover:bg-[#F1F5F9]"
          >
            ×
          </button>
        </header>
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#D7E0EA] bg-white px-3 sm:px-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setItemId("");
              }}
              className={`whitespace-nowrap border-b-[3px] px-4 py-3 text-sm font-bold ${tab === t.id ? "border-[#C2410C] text-[#0B1F3A]" : "border-transparent text-[#64748B] hover:text-[#0B1F3A]"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-[#D7E0EA] bg-white p-3">
              <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wide text-[#64748B]">
                Students
              </p>
              <select
                className={`${control} mb-2 lg:hidden`}
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value);
                  setItemId("");
                }}
              >
                {data.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="hidden max-h-[62dvh] space-y-1 overflow-y-auto lg:block">
                {data.students.map((s) => {
                  const count = data.evaluations.filter(
                    (e) =>
                      e.student_id === s.id &&
                      (tab === "session"
                        ? e.schedule_id === sessionId
                        : e.source_type === tab),
                  ).length;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setStudentId(s.id);
                        setItemId("");
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold ${studentId === s.id ? "bg-[#FFF1E7] text-[#9A3412]" : "text-[#0B1F3A] hover:bg-[#F1F5F9]"}`}
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              {studentId && <RecognitionPanel key={studentId} groupId={data.group_id} studentId={studentId} />}
            </aside>
            <main className="min-w-0 space-y-4">
              {tab === "session" ? (
                <>
                  <div className="rounded-2xl border border-[#D7E0EA] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[#0B1F3A]">
                          Session evaluations
                        </p>
                        <p className="text-xs font-semibold text-[#64748B]">
                          {evaluatedCount} of {data.students.length} students
                          started for this session
                        </p>
                      </div>
                      <select
                        aria-label="Select session"
                        className="min-h-11 min-w-[210px] rounded-xl border border-[#D7E0EA] px-3 text-sm font-semibold"
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                      >
                        {data.sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title} ·{" "}
                            {new Date(s.scheduled_at).toLocaleDateString(
                              "en-GB",
                            )}{" "}
                            ({s.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {sessionId && student ? (
                    <>
                      <div className="rounded-2xl border border-[#D7E0EA] bg-white p-4">
                        <p className="mb-3 text-sm font-bold text-[#0B1F3A]">
                          {student.name} · choose a skill
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {SESSION_CRITERIA.map((c) => {
                            const row = data.evaluations.find(
                              (e) =>
                                e.student_id === studentId &&
                                e.schedule_id === sessionId &&
                                e.criterion === c.key,
                            );
                            return (
                              <button
                                key={c.key}
                                onClick={() => setCriterion(c.key)}
                                className={`rounded-xl border px-3 py-3 text-left ${criterion === c.key ? "border-[#C2410C] bg-[#FFF1E7]" : "border-[#D7E0EA] hover:bg-[#F8FAFC]"}`}
                              >
                                <span className="block text-sm font-bold text-[#0B1F3A]">
                                  {c.label}
                                </span>
                                <span className="text-xs font-semibold text-[#9A3412]">
                                  {row
                                    ? `${row.rating ?? "—"} stars${row.score != null ? ` · ${row.score}/100` : ""}`
                                    : "Not rated yet"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <Editor
                        key={`${studentId}-${sessionId}-${criterion}`}
                        data={data}
                        studentId={studentId}
                        source="session"
                        sourceId={sessionId}
                        criterion={criterion}
                        onSaved={onChange}
                      />
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#D7E0EA] bg-white p-8 text-center text-sm text-[#64748B]">
                      No sessions in this group yet.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-[#D7E0EA] bg-white p-4">
                    <h3 className="text-sm font-bold text-[#0B1F3A]">
                      {student?.name} · {TABS.find((t) => t.id === tab)?.label}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-[#64748B]">
                      Choose an item to add or edit its evaluation. Items are
                      shown from the student&apos;s work.
                    </p>
                    <div className="mt-3 grid gap-2">
                      {studentItems.map((item: CenterItem) => {
                        const row = data.evaluations.find(
                          (e) =>
                            e.student_id === studentId &&
                            e.source_type === tab &&
                            e.source_id === item.id,
                        );
                        return (
                          <button
                            key={item.id}
                            onClick={() => setItemId(item.id)}
                            className={`rounded-xl border px-3 py-3 text-left ${currentId === item.id ? "border-[#C2410C] bg-[#FFF1E7]" : "border-[#D7E0EA] hover:bg-[#F8FAFC]"}`}
                          >
                            <span className="block text-sm font-bold text-[#0B1F3A]">
                              {item.title}
                            </span>
                            <span className="block text-xs text-[#64748B]">
                              {item.subtitle}
                            </span>
                            <span className="mt-1 block text-xs font-bold text-[#9A3412]">
                              {row
                                ? `${row.rating ?? "—"} stars${row.score != null ? ` · ${row.score}/100` : ""}`
                                : "Not evaluated yet"}
                              {item.score != null
                                ? ` · Existing grade ${item.score}/${item.max_score ?? 100}`
                                : ""}
                            </span>
                          </button>
                        );
                      })}
                      {!studentItems.length && (
                        <p className="rounded-xl bg-[#F8FAFC] px-4 py-5 text-sm font-semibold text-[#64748B]">
                          No {tab}s for this student yet.
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedItem && (
                    <>
                      {selectedItem.url && (
                        <a
                          href={selectedItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex rounded-xl border border-[#BDECF5] bg-[#EFFBFE] px-4 py-2 text-sm font-bold text-[#0E7490] hover:bg-[#DBF5FC]"
                        >
                          Open {tab} ↗
                        </a>
                      )}
                      <Editor
                        key={`${studentId}-${tab}-${currentId}`}
                        data={data}
                        studentId={studentId}
                        source={tab}
                        sourceId={currentId}
                        criterion="CUSTOM"
                        onSaved={onChange}
                      />
                    </>
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function EvaluationCenter({ groups }: { groups: Group[] }) {
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("all");
  const [day, setDay] = useState("all");
  const [progress, setProgress] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [data, setData] = useState<GroupEvaluationData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const branches = useMemo(
    () => [...new Set(groups.map((g) => g.branch).filter(Boolean))].sort(),
    [groups],
  );
  const days = useMemo(
    () =>
      DAY_ORDER.filter((value) =>
        groups.some((group) => group.day?.toLowerCase() === value),
      ),
    [groups],
  );
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return groups.filter((g) => {
      const matchesQuery = `${g.name} ${g.code ?? ""} ${g.course} ${g.branch}`
        .toLowerCase()
        .includes(normalizedQuery);
      const matchesBranch = branch === "all" || g.branch === branch;
      const matchesDay = day === "all" || g.day?.toLowerCase() === day;
      const matchesProgress =
        progress === "all" ||
        (progress === "with-sessions"
          ? g.completedSessions > 0
          : g.completedSessions === 0);
      return matchesQuery && matchesBranch && matchesDay && matchesProgress;
    });
  }, [branch, day, groups, progress, query]);
  const hasFilters =
    branch !== "all" ||
    day !== "all" ||
    progress !== "all" ||
    query.trim() !== "";
  function clearFilters() {
    setQuery("");
    setBranch("all");
    setDay("all");
    setProgress("all");
  }
  async function openGroup(id: string) {
    setOpenId(id);
    setBusy(true);
    setError("");
    setData(null);
    const result = await loadGroupEvaluations(id);
    if (result.success) setData(result.data);
    else setError(result.error);
    setBusy(false);
  }
  function close() {
    setOpenId(null);
    setData(null);
    setError("");
  }
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Evaluation Center</h1>
        <p className="mt-1 text-sm font-semibold text-[#475569]">
          Choose a group, then evaluate each session, assignment, video, or
          project.
        </p>
        <p className="mt-2 max-w-3xl text-sm text-[#475569]">Celebrate a specific strength in your feedback, then set a practical next goal. Published ratings and goals become the student and parent progress summary.</p>
      </header>
      <div className="rounded-2xl border border-[#D7E0EA] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#0B1F3A]">Find a group</h2>
            <p className="mt-1 text-xs font-medium text-[#64748B]">
              Narrow your list by branch, teaching day, or session progress.
            </p>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg px-2 py-1 text-xs font-bold text-[#0E7490] hover:bg-[#EFFBFE]"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-semibold text-[#334155] md:col-span-2 xl:col-span-1">
            Search
            <input
              className={`${control} mt-1`}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Group, course or code"
            />
          </label>
          <label className="block text-sm font-semibold text-[#334155]">
            Branch
            <select
              className={`${control} mt-1`}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="all">All branches</option>
              {branches.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-[#334155]">
            Group day
            <select
              className={`${control} mt-1`}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            >
              <option value="all">All days</option>
              {days.map((value) => (
                <option key={value} value={value}>
                  {dayLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-[#334155]">
            Evaluation progress
            <select
              className={`${control} mt-1`}
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
            >
              <option value="all">All groups</option>
              <option value="with-sessions">Has completed sessions</option>
              <option value="no-sessions">No completed sessions yet</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs font-semibold text-[#64748B]">
          Showing {filtered.length} of {groups.length} assigned groups
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((g) => (
          <button
            key={g.id}
            onClick={() => openGroup(g.id)}
            className="rounded-2xl border border-[#D7E0EA] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0E7490] hover:shadow-md"
          >
            <span className="text-xs font-bold text-[#0E7490]">
              {g.branch} · {g.course}
            </span>
            <h2 className="mt-2 text-base font-bold text-[#0B1F3A]">
              {g.name}
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">
              {g.code} {g.day ? `· ${dayLabel(g.day)}` : ""}
            </p>
            <div className="mt-4 flex justify-between border-t border-[#E2E8F0] pt-3 text-sm font-semibold text-[#475569]">
              <span>{g.studentCount} students</span>
              <span>{g.completedSessions} sessions</span>
              <span className="text-[#C2410C]">Evaluate →</span>
            </div>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <p className="rounded-2xl border border-dashed border-[#D7E0EA] bg-white p-8 text-center text-sm font-semibold text-[#64748B]">
          {groups.length
            ? "No groups match these filters."
            : "No groups assigned yet."}
        </p>
      )}
      {openId && (busy || error) && (
        <div
          className="ds-modal-backdrop fixed inset-0 z-[80] flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl"
          >
            <p className="text-sm font-semibold text-[#0B1F3A]">
              {busy ? "Loading group evaluations…" : error}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={close}
                className="rounded-xl border border-[#D7E0EA] px-4 py-2 text-sm font-bold"
              >
                Close
              </button>
              {error && (
                <button
                  onClick={() => openGroup(openId)}
                  className="rounded-xl bg-[#C2410C] px-4 py-2 text-sm font-bold text-white"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {openId && data && !busy && (
        <Workspace
          key={openId}
          data={data}
          onClose={close}
          onChange={setData}
        />
      )}
    </div>
  );
}
