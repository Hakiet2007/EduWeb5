import { Router } from "express";
import { db } from "@workspace/db";
import {
  assignmentsTable,
  classesTable,
  classEnrollmentsTable,
  submissionsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireTeacher } from "../middlewares/auth";

const router = Router();

router.get("/assignments", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const role = req.session.userRole;

    if (role === "teacher") {
      const teacherClasses = await db
        .select({ id: classesTable.id, name: classesTable.name })
        .from(classesTable)
        .where(eq(classesTable.teacherId, userId));

      const result = await Promise.all(
        teacherClasses.flatMap(async (cls) => {
          const assignments = await db
            .select()
            .from(assignmentsTable)
            .where(eq(assignmentsTable.classId, cls.id));
          return assignments.map(async (a) => {
            const submissions = await db
              .select()
              .from(submissionsTable)
              .where(eq(submissionsTable.assignmentId, a.id));
            return {
              ...a,
              className: cls.name,
              dueDate: a.dueDate ? a.dueDate.toISOString() : null,
              createdAt: a.createdAt.toISOString(),
              submissionCount: submissions.length,
            };
          });
        }),
      );
      const flat = await Promise.all(result.flat());
      res.json(flat);
    } else {
      const enrollments = await db
        .select({ classId: classEnrollmentsTable.classId })
        .from(classEnrollmentsTable)
        .where(eq(classEnrollmentsTable.studentId, userId));

      const classIds = enrollments.map((e) => e.classId);
      if (classIds.length === 0) {
        res.json([]);
        return;
      }

      const allAssignments = await Promise.all(
        classIds.map(async (classId) => {
          const [cls] = await db
            .select({ name: classesTable.name })
            .from(classesTable)
            .where(eq(classesTable.id, classId))
            .limit(1);

          const assignments = await db
            .select()
            .from(assignmentsTable)
            .where(eq(assignmentsTable.classId, classId));

          return Promise.all(
            assignments.map(async (a) => {
              const [mySubmission] = await db
                .select()
                .from(submissionsTable)
                .where(
                  and(
                    eq(submissionsTable.assignmentId, a.id),
                    eq(submissionsTable.studentId, userId),
                  ),
                )
                .limit(1);

              return {
                ...a,
                className: cls?.name ?? "",
                dueDate: a.dueDate ? a.dueDate.toISOString() : null,
                createdAt: a.createdAt.toISOString(),
                mySubmission: mySubmission
                  ? {
                      ...mySubmission,
                      createdAt: mySubmission.createdAt.toISOString(),
                    }
                  : null,
              };
            }),
          );
        }),
      );

      res.json(allAssignments.flat());
    }
  } catch (err) {
    req.log.error({ err }, "listAssignments error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/assignments", requireTeacher, async (req, res) => {
  const { title, description, classId, dueDate } = req.body;
  if (!title || !classId) {
    res.status(400).json({ error: "Title and classId are required" });
    return;
  }

  try {
    const [cls] = await db
      .select()
      .from(classesTable)
      .where(
        and(
          eq(classesTable.id, Number(classId)),
          eq(classesTable.teacherId, req.session.userId!),
        ),
      )
      .limit(1);

    if (!cls) {
      res.status(403).json({ error: "Class not found or not yours" });
      return;
    }

    const [assignment] = await db
      .insert(assignmentsTable)
      .values({
        title,
        description: description ?? null,
        classId: Number(classId),
        dueDate: dueDate ? new Date(dueDate) : null,
      })
      .returning();

    res.status(201).json({
      ...assignment,
      className: cls.name,
      dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
      createdAt: assignment.createdAt.toISOString(),
      submissionCount: 0,
    });
  } catch (err) {
    req.log.error({ err }, "createAssignment error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/assignments/:assignmentId", requireAuth, async (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId ?? "");
  if (isNaN(assignmentId)) {
    res.status(400).json({ error: "Invalid assignment ID" });
    return;
  }

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

    const [cls] = await db
      .select()
      .from(classesTable)
      .where(eq(classesTable.id, assignment.classId))
      .limit(1);

    res.json({
      ...assignment,
      className: cls?.name ?? "",
      dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
      createdAt: assignment.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "getAssignment error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
