import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import EvaluationCenter from "@/app/portal/instructor/evaluations/EvaluationCenter";
import type { GroupEvaluationData } from "@/modules/student-evaluations/center";

const loadGroupEvaluations = vi.fn();
const saveCenterEvaluation = vi.fn();
const awardCenterRecognition = vi.fn();
vi.mock("@/modules/student-evaluations/center-actions", () => ({
  loadGroupEvaluations: (...args: unknown[]) => loadGroupEvaluations(...args),
  saveCenterEvaluation: (...args: unknown[]) => saveCenterEvaluation(...args),
  awardCenterRecognition: (...args: unknown[]) =>
    awardCenterRecognition(...args),
}));

const groupId = "11111111-1111-4111-8111-111111111111";
const studentId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";
const data: GroupEvaluationData = {
  group_id: groupId,
  group_name: "Python Stars",
  students: [{ id: studentId, name: "Aya Student" }],
  sessions: [
    {
      id: sessionId,
      title: "Session 1",
      scheduled_at: "2026-10-01T12:00:00Z",
      status: "completed",
    },
  ],
  assignments: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      student_id: studentId,
      title: "Loops exercise",
      subtitle: "Submitted",
      url: null,
    },
  ],
  videos: [],
  projects: [],
  evaluations: [],
};
const groups = [
  {
    id: groupId,
    name: data.group_name,
    code: "GRP-1",
    course: "Python",
    branch: "ElShrouk",
    day: "monday",
    studentCount: 1,
    completedSessions: 1,
  },
];

beforeEach(() => {
  loadGroupEvaluations.mockResolvedValue({ success: true, data });
  saveCenterEvaluation.mockResolvedValue({
    success: true,
    data: { id: "55555555-5555-4555-8555-555555555555" },
  });
  awardCenterRecognition.mockResolvedValue({ success: true });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.body.style.overflow = "";
});

describe("Evaluation Center", () => {
  it("awards a selected recognition badge to the current student", async () => {
    render(<EvaluationCenter groups={groups} />);
    fireEvent.click(screen.getByRole("button", { name: /Python Stars/ }));
    await screen.findByRole("dialog", { name: "Python Stars evaluations" });
    fireEvent.change(screen.getByLabelText("Recognition badge"), {
      target: { value: "🤝 Team Player" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Award badge" }));
    await waitFor(() =>
      expect(awardCenterRecognition).toHaveBeenCalledWith({
        group_id: groupId,
        student_id: studentId,
        badge_name: "🤝 Team Player",
      }),
    );
    expect(
      await screen.findByText(
        "Badge awarded. The student can see it in Achievements.",
      ),
    ).toBeInTheDocument();
  });

  it("filters assigned groups by branch, teaching day, and session progress", () => {
    const filteredGroups = [
      ...groups,
      {
        id: "66666666-6666-4666-8666-666666666666",
        name: "Scratch Makers",
        code: "GRP-2",
        course: "Scratch",
        branch: "Madinaty",
        day: "tuesday",
        studentCount: 3,
        completedSessions: 0,
      },
    ];
    render(<EvaluationCenter groups={filteredGroups} />);

    fireEvent.change(screen.getByLabelText("Branch"), {
      target: { value: "Madinaty" },
    });
    expect(screen.getByText("Scratch Makers")).toBeInTheDocument();
    expect(screen.queryByText("Python Stars")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Group day"), {
      target: { value: "monday" },
    });
    expect(
      screen.getByText("No groups match these filters."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.change(screen.getByLabelText("Evaluation progress"), {
      target: { value: "no-sessions" },
    });
    expect(screen.getByText("Scratch Makers")).toBeInTheDocument();
    expect(screen.queryByText("Python Stars")).not.toBeInTheDocument();
  });

  it("opens the group, switches tabs, and closes with Escape", async () => {
    render(<EvaluationCenter groups={groups} />);
    fireEvent.click(screen.getByRole("button", { name: /Python Stars/ }));
    expect(
      await screen.findByRole("dialog", { name: "Python Stars evaluations" }),
    ).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Assignments" }));
    expect(screen.getByText("Loops exercise")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("saves an unpublished draft, then publishes for student and parent", async () => {
    render(<EvaluationCenter groups={groups} />);
    fireEvent.click(screen.getByRole("button", { name: /Python Stars/ }));
    await screen.findByRole("dialog", { name: "Python Stars evaluations" });
    fireEvent.click(screen.getByRole("button", { name: "4 stars" }));
    fireEvent.change(
      screen.getByPlaceholderText("One clear goal for the next session"),
      { target: { value: "Try a loop independently" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(saveCenterEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          group_id: groupId,
          student_id: studentId,
          source: "session",
          source_id: sessionId,
          criterion: "PROGRAMMING",
          rating: 4,
          publish: false,
          next_goal: "Try a loop independently",
        }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish evaluation" }));
    await waitFor(() =>
      expect(saveCenterEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          publish: true,
          visible_to_student: true,
          visible_to_parent: true,
        }),
      ),
    );
  });
});
