"use server";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePermission } from "@/modules/rbac/guards";
import { logTimelineEvent } from "@/lib/timeline";
import {
  seedAchievementEarnedNotification,
  seedEvaluationPublishedNotification,
} from "@/modules/notifications/actions";
import {
  getStudentUserId,
  getParentUserIdsForStudent,
} from "@/modules/notifications/queries";
import { revalidatePath } from "next/cache";
import {
  getGroupEvaluationData,
  groupAssignmentIds,
  requireEvaluationGroup,
} from "./center-queries";
import { SESSION_CRITERIA } from "./center";

const recognitionSchema = z.object({
  group_id: z.string().uuid(),
  student_id: z.string().uuid(),
  badge_name: z.enum([
    "💡 Creative Thinker",
    "🤝 Team Player",
    "🚀 Persistent Learner",
  ]),
});

export async function awardCenterRecognition(
  raw: z.infer<typeof recognitionSchema>,
) {
  const parsed = recognitionSchema.safeParse(raw);
  if (!parsed.success)
    return {
      success: false as const,
      error: "Choose a valid recognition badge.",
    };
  try {
    const { user } = await requireEvaluationGroup(parsed.data.group_id);
    const db = createServiceClient();
    const { data: member } = await db
      .from("group_students")
      .select("student_id")
      .eq("group_id", parsed.data.group_id)
      .eq("student_id", parsed.data.student_id)
      .eq("status", "active")
      .maybeSingle();
    if (!member) throw new Error("Student is not active in this group.");
    const { data: existing } = await db
      .from("student_badges")
      .select("id")
      .eq("student_id", parsed.data.student_id)
      .eq("badge_name", parsed.data.badge_name)
      .maybeSingle();
    if (existing)
      throw new Error("This student has already earned this badge.");
    const descriptions: Record<typeof parsed.data.badge_name, string> = {
      "💡 Creative Thinker":
        "Recognized by an instructor for creative thinking.",
      "🤝 Team Player":
        "Recognized by an instructor for helping and collaborating.",
      "🚀 Persistent Learner":
        "Recognized by an instructor for effort and persistence.",
    };
    const { data: badge, error } = await db
      .from("student_badges")
      .insert({
        student_id: parsed.data.student_id,
        badge_name: parsed.data.badge_name,
        description: descriptions[parsed.data.badge_name],
      })
      .select("id")
      .single();
    if (error || !badge)
      throw new Error(error?.message ?? "Could not award badge.");
    await Promise.allSettled([
      logTimelineEvent({
        student_id: parsed.data.student_id,
        event_type: "BADGE_EARNED",
        notes: parsed.data.badge_name,
        created_by: user.id,
      }),
      (async () => {
        const studentUserId = await getStudentUserId(parsed.data.student_id);
        if (studentUserId)
          await seedAchievementEarnedNotification(
            studentUserId,
            badge.id,
            parsed.data.badge_name,
          );
      })(),
    ]);
    revalidatePath("/portal/student/achievements");
    revalidatePath("/portal/student/evaluations");
    revalidatePath("/portal/parent/evaluations");
    revalidatePath("/portal/student");
    revalidatePath("/portal/parent");
    revalidatePath("/portal/parent/portfolio");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not award badge.",
    };
  }
}

const inputSchema = z
  .object({
    group_id: z.string().uuid(),
    student_id: z.string().uuid(),
    source: z.enum(["session", "assignment", "video", "project"]),
    source_id: z.string().uuid(),
    criterion: z.string().min(1),
    rating: z.number().int().min(1).max(5).nullable(),
    score: z.number().min(0).max(100).nullable(),
    feedback: z.string().max(2000).nullable(),
    next_goal: z.string().max(500).nullable(),
    publish: z.boolean(),
    visible_to_student: z.boolean(),
    visible_to_parent: z.boolean(),
  })
  .refine((v) => v.rating !== null || v.score !== null, {
    message: "Add stars or a score before saving.",
  })
  .refine((v) => !v.publish || v.visible_to_student || v.visible_to_parent, {
    message: "Choose student or parent visibility before publishing.",
  });

type Input = z.infer<typeof inputSchema>;

export async function loadGroupEvaluations(groupId: string) {
  try {
    return {
      success: true as const,
      data: await getGroupEvaluationData(groupId),
    };
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : "Could not load evaluations.",
    };
  }
}

export async function saveCenterEvaluation(raw: Input) {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success)
    return { success: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  try {
    const { user } = await requireEvaluationGroup(d.group_id);
    const db = createServiceClient();
    const { data: group, error: groupError } = await db
      .from("groups")
      .select("branch_id")
      .eq("id", d.group_id)
      .single();
    if (groupError || !group) throw new Error("Group not found.");
    await requirePermission("manage_evaluations", {
      branchId: group.branch_id,
    });
    const { data: membership } = await db
      .from("group_students")
      .select("student_id")
      .eq("group_id", d.group_id)
      .eq("student_id", d.student_id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) throw new Error("Student is not active in this group.");

    let label = "";
    if (d.source === "session") {
      if (!SESSION_CRITERIA.some((c) => c.key === d.criterion))
        throw new Error("Invalid session criterion.");
      const { data: gcRows } = await db
        .from("group_courses")
        .select("id")
        .eq("group_id", d.group_id);
      const gcIds = (gcRows ?? []).map((g) => g.id as string);
      if (!gcIds.length) throw new Error("Group has no course.");
      const { data: session } = await db
        .from("schedules")
        .select("id, status")
        .eq("id", d.source_id)
        .in("group_course_id", gcIds)
        .neq("status", "cancelled")
        .maybeSingle();
      if (!session) throw new Error("Session does not belong to this group.");
      label = SESSION_CRITERIA.find((c) => c.key === d.criterion)!.label;
    } else {
      if (d.criterion !== "CUSTOM") throw new Error("Invalid item criterion.");
      const table =
        d.source === "assignment"
          ? "submissions"
          : d.source === "video"
            ? "student_videos"
            : "portfolio_projects";
      const { data: item } = await db
        .from(table)
        .select("id, student_id")
        .eq("id", d.source_id)
        .eq("student_id", d.student_id)
        .maybeSingle();
      if (!item) throw new Error("Item does not belong to this student.");
      if (d.source === "assignment") {
        const { data: submission } = await db
          .from("submissions")
          .select("assignment_id")
          .eq("id", d.source_id)
          .single();
        const { data: gcRows } = await db
          .from("group_courses")
          .select("id, course_id")
          .eq("group_id", d.group_id);
        const gcIds = (gcRows ?? []).map((g) => g.id as string);
        const courseIds = [
          ...new Set(
            (gcRows ?? []).map((g) => g.course_id as string).filter(Boolean),
          ),
        ];
        const { data: sessions } = gcIds.length
          ? await db.from("schedules").select("id").in("group_course_id", gcIds)
          : { data: [] };
        const ids = await groupAssignmentIds(
          courseIds,
          (sessions ?? []).map((s) => s.id as string),
        );
        if (!submission || !ids.includes(submission.assignment_id))
          throw new Error("Assignment does not belong to this group.");
      }
      label =
        d.source === "assignment"
          ? "Assignment"
          : d.source === "video"
            ? "Video"
            : "Project";
    }

    const match = db
      .from("student_evaluations")
      .select("id, visible_to_student, visible_to_parent, published_at")
      .eq("student_id", d.student_id)
      .eq("group_id", d.group_id)
      .eq("author_id", user.id)
      .eq("criterion", d.criterion)
      .is("deleted_at", null);
    const lookup =
      d.source === "session"
        ? match.eq("schedule_id", d.source_id).is("source_id", null)
        : match.eq("source_type", d.source).eq("source_id", d.source_id);
    const { data: existing, error: lookupError } = await lookup.maybeSingle();
    if (lookupError) throw new Error(lookupError.message);

    const visibleToStudent = d.publish && d.visible_to_student;
    const visibleToParent = d.publish && d.visible_to_parent;
    const patch = {
      rating: d.rating,
      score: d.score,
      feedback: d.feedback,
      next_goal: d.next_goal,
      visible_to_student: visibleToStudent,
      visible_to_parent: visibleToParent,
      // Keep the first-publication timestamp even when temporarily hidden as a
      // draft, so republishing cannot send duplicate "new evaluation" notices.
      published_at:
        existing?.published_at ?? (d.publish ? new Date().toISOString() : null),
      evaluated_at: new Date().toISOString().slice(0, 10),
    };
    const result = existing
      ? await db
          .from("student_evaluations")
          .update(patch)
          .eq("id", existing.id)
          .eq("author_id", user.id)
          .select("id")
          .single()
      : await db
          .from("student_evaluations")
          .insert({
            ...patch,
            student_id: d.student_id,
            group_id: d.group_id,
            branch_id: group.branch_id,
            author_id: user.id,
            criterion: d.criterion,
            custom_label: d.source === "session" ? null : label,
            schedule_id: d.source === "session" ? d.source_id : null,
            source_type: d.source === "session" ? null : d.source,
            source_id: d.source === "session" ? null : d.source_id,
          })
          .select("id")
          .single();
    if (result.error || !result.data)
      throw new Error(result.error?.message ?? "Could not save evaluation.");

    const firstPublish = d.publish && !existing?.published_at;
    if (firstPublish) {
      try {
        const [studentUserId, parentIds] = await Promise.all([
          getStudentUserId(d.student_id),
          getParentUserIdsForStudent(d.student_id),
        ]);
        await Promise.allSettled([
          ...(visibleToStudent && studentUserId
            ? [
                seedEvaluationPublishedNotification(
                  studentUserId,
                  result.data.id,
                  label,
                ),
              ]
            : []),
          ...(visibleToParent
            ? parentIds.map((pid) =>
                seedEvaluationPublishedNotification(pid, result.data.id, label),
              )
            : []),
        ]);
      } catch {
        /* Notifications do not undo a saved evaluation. */
      }
    }
    void logTimelineEvent({
      student_id: d.student_id,
      event_type: "EVALUATION_RECORDED",
      notes: `${label} · ${d.rating ?? d.score}`,
      created_by: user.id,
      branch_id: group.branch_id,
    }).catch(() => {});
    revalidatePath("/portal/student/evaluations");
    revalidatePath("/portal/parent/evaluations");
    revalidatePath("/portal/instructor/evaluations");
    return { success: true as const, data: { id: result.data.id } };
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : "Could not save evaluation.",
    };
  }
}
