import { Router } from "express";
import { db } from "@workspace/db";
import {
  classesTable,
  assignmentsTable,
  submissionsTable,
  classEnrollmentsTable,
} from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const role = req.session.userRole;

    if (role === "teacher") {
      const classes = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(eq(classesTable.teacherId, userId));

      const classIds = classes.map((c) => c.id);
      const classCount = classIds.length;

      if (classCount === 0) {
        res.json({ classCount: 0, assignmentCount: 0, submissionCount: 0, pendingCount: 0 });
        return;
      }

      let assignmentCount = 0;
      let submissionCount = 0;
      let pendingCount = 0;

      for (const classId of classIds) {
        const assignments = await db
          .select({ id: assignmentsTable.id })
          .from(assignmentsTable)
          .where(eq(assignmentsTable.classId, classId));

        assignmentCount += assignments.length;

        for (const assignment of assignments) {
          const allSubs = await db
            .select({ id: submissionsTable.id })
            .from(submissionsTable)
            .where(eq(submissionsTable.assignmentId, assignment.id));

          submissionCount += allSubs.length;

          const pendingSubs = await db
            .select({ id: submissionsTable.id })
            .from(submissionsTable)
            .where(
              and(
                eq(submissionsTable.assignmentId, assignment.id),
                isNull(submissionsTable.grade),
              ),
            );

          pendingCount += pendingSubs.length;
        }
      }

      res.json({ classCount, assignmentCount, submissionCount, pendingCount });
    } else {
      const enrollments = await db
        .select({ classId: classEnrollmentsTable.classId })
        .from(classEnrollmentsTable)
        .where(eq(classEnrollmentsTable.studentId, userId));

      const classIds = enrollments.map((e) => e.classId);
      const classCount = classIds.length;

      if (classCount === 0) {
        res.json({ classCount: 0, assignmentCount: 0, submissionCount: 0, pendingCount: 0 });
        return;
      }

      let assignmentCount = 0;
      let submissionCount = 0;
      let pendingCount = 0;

      for (const classId of classIds) {
        const assignments = await db
          .select({ id: assignmentsTable.id })
          .from(assignmentsTable)
          .where(eq(assignmentsTable.classId, classId));

        assignmentCount += assignments.length;

        for (const assignment of assignments) {
          const [mySubmission] = await db
            .select()
            .from(submissionsTable)
            .where(
              and(
                eq(submissionsTable.assignmentId, assignment.id),
                eq(submissionsTable.studentId, userId),
              ),
            )
            .limit(1);

          if (mySubmission) {
            submissionCount++;
          } else {
            pendingCount++;
          }
        }
      }

      res.json({ classCount, assignmentCount, submissionCount, pendingCount });
    }
  } catch (err) {
    req.log.error({ err }, "getDashboardStats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
