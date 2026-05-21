import { Router } from "express";
import { db } from "@workspace/db";
import {
  submissionsTable,
  assignmentsTable,
  classesTable,
  classEnrollmentsTable,
  usersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireTeacher } from "../middlewares/auth";

const router = Router();

router.get("/assignments/:assignmentId/submissions", requireAuth, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId ?? "");
  if (isNaN(assignmentId)) {
    res.status(400).json({ error: "Invalid assignment ID" });
    return;
  }

  try {
    const submissions = await db
      .select({
        id: submissionsTable.id,
        assignmentId: submissionsTable.assignmentId,
        studentId: submissionsTable.studentId,
        content: submissionsTable.content,
        grade: submissionsTable.grade,
        feedback: submissionsTable.feedback,
        createdAt: submissionsTable.createdAt,
        studentName: usersTable.name,
      })
      .from(submissionsTable)
      .innerJoin(usersTable, eq(submissionsTable.studentId, usersTable.id))
      .where(eq(submissionsTable.assignmentId, assignmentId));

    res.json(
      submissions.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "listSubmissions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/assignments/:assignmentId/submissions", requireAuth, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId ?? "");
  if (isNaN(assignmentId)) {
    res.status(400).json({ error: "Invalid assignment ID" });
    return;
  }

  const { content } = req.body;
  if (!content) {
    res.status(400).json({ error: "Content is required" });
    return;
  }

  const userId = req.session.userId!;

  try {
    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, assignmentId))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    const [enrollment] = await db
      .select()
      .from(classEnrollmentsTable)
      .where(
        and(
          eq(classEnrollmentsTable.classId, assignment.classId),
          eq(classEnrollmentsTable.studentId, userId),
        ),
      )
      .limit(1);

    if (!enrollment) {
      res.status(403).json({ error: "Not enrolled in this class" });
      return;
    }

    const [existing] = await db
      .select()
      .from(submissionsTable)
      .where(
        and(
          eq(submissionsTable.assignmentId, assignmentId),
          eq(submissionsTable.studentId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      res.status(400).json({ error: "Already submitted" });
      return;
    }

    const [submission] = await db
      .insert(submissionsTable)
      .values({ assignmentId, studentId: userId, content })
      .returning();

    const [user] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    res.status(201).json({
      ...submission,
      studentName: user?.name ?? "",
      createdAt: submission.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "submitAssignment error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch(
  "/assignments/:assignmentId/submissions/:submissionId/grade",
  requireTeacher,
  async (req, res) => {
    const submissionId = parseInt(req.params.submissionId ?? "");
    const assignmentId = parseInt(req.params.assignmentId ?? "");
    if (isNaN(submissionId) || isNaN(assignmentId)) {
      res.status(400).json({ error: "Invalid IDs" });
      return;
    }

    const { grade, feedback } = req.body;
    if (!grade) {
      res.status(400).json({ error: "Grade is required" });
      return;
    }

    try {
      const [submission] = await db
        .select()
        .from(submissionsTable)
        .where(
          and(
            eq(submissionsTable.id, submissionId),
            eq(submissionsTable.assignmentId, assignmentId),
          ),
        )
        .limit(1);

      if (!submission) {
        res.status(404).json({ error: "Submission not found" });
        return;
      }

      const [assignment] = await db
        .select()
        .from(assignmentsTable)
        .where(eq(assignmentsTable.id, assignmentId))
        .limit(1);

      if (!assignment) {
        res.status(404).json({ error: "Assignment not found" });
        return;
      }

      const [cls] = await db
        .select()
        .from(classesTable)
        .where(
          and(
            eq(classesTable.id, assignment.classId),
            eq(classesTable.teacherId, req.session.userId!),
          ),
        )
        .limit(1);

      if (!cls) {
        res.status(403).json({ error: "Not authorized to grade this submission" });
        return;
      }

      const [updated] = await db
        .update(submissionsTable)
        .set({ grade, feedback: feedback ?? null })
        .where(eq(submissionsTable.id, submissionId))
        .returning();

      const [user] = await db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, updated.studentId))
        .limit(1);

      res.json({
        ...updated,
        studentName: user?.name ?? "",
        createdAt: updated.createdAt.toISOString(),
      });
    } catch (err) {
      req.log.error({ err }, "gradeSubmission error");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
