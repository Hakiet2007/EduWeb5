import { Router } from "express";
import { db } from "@workspace/db";
import { classesTable, classEnrollmentsTable, usersTable, assignmentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireTeacher } from "../middlewares/auth";
import { randomBytes } from "crypto";

const router = Router();

router.get("/classes", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const role = req.session.userRole;

    if (role === "teacher") {
      const classes = await db
        .select({
          id: classesTable.id,
          name: classesTable.name,
          description: classesTable.description,
          inviteCode: classesTable.inviteCode,
          teacherId: classesTable.teacherId,
          createdAt: classesTable.createdAt,
        })
        .from(classesTable)
        .where(eq(classesTable.teacherId, userId));

      const result = await Promise.all(
        classes.map(async (c) => {
          const enrollments = await db
            .select()
            .from(classEnrollmentsTable)
            .where(eq(classEnrollmentsTable.classId, c.id));
          const teacher = await db
            .select({ name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);
          return {
            ...c,
            teacherName: teacher[0]?.name ?? "",
            studentCount: enrollments.length,
            createdAt: c.createdAt.toISOString(),
          };
        }),
      );
      res.json(result);
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

      const result = await Promise.all(
        classIds.map(async (classId) => {
          const [c] = await db
            .select()
            .from(classesTable)
            .where(eq(classesTable.id, classId))
            .limit(1);
          if (!c) return null;

          const [teacher] = await db
            .select({ name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, c.teacherId))
            .limit(1);

          const allEnrollments = await db
            .select()
            .from(classEnrollmentsTable)
            .where(eq(classEnrollmentsTable.classId, classId));

          return {
            ...c,
            teacherName: teacher?.name ?? "",
            studentCount: allEnrollments.length,
            createdAt: c.createdAt.toISOString(),
          };
        }),
      );
      res.json(result.filter(Boolean));
    }
  } catch (err) {
    req.log.error({ err }, "listClasses error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/classes", requireTeacher, async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  try {
    const inviteCode = randomBytes(4).toString("hex").toUpperCase();
    const [cls] = await db
      .insert(classesTable)
      .values({
        name,
        description: description ?? null,
        inviteCode,
        teacherId: req.session.userId!,
      })
      .returning();

    const [teacher] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId!))
      .limit(1);

    res.status(201).json({
      ...cls,
      teacherName: teacher?.name ?? "",
      studentCount: 0,
      createdAt: cls.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "createClass error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/classes/join", requireAuth, async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) {
    res.status(400).json({ error: "Invite code required" });
    return;
  }

  try {
    const [cls] = await db
      .select()
      .from(classesTable)
      .where(eq(classesTable.inviteCode, inviteCode.toUpperCase()))
      .limit(1);

    if (!cls) {
      res.status(400).json({ error: "Invalid invite code" });
      return;
    }

    const userId = req.session.userId!;

    const existing = await db
      .select()
      .from(classEnrollmentsTable)
      .where(
        and(
          eq(classEnrollmentsTable.classId, cls.id),
          eq(classEnrollmentsTable.studentId, userId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(400).json({ error: "Already enrolled in this class" });
      return;
    }

    await db.insert(classEnrollmentsTable).values({
      classId: cls.id,
      studentId: userId,
    });

    const enrollments = await db
      .select()
      .from(classEnrollmentsTable)
      .where(eq(classEnrollmentsTable.classId, cls.id));

    const [teacher] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, cls.teacherId))
      .limit(1);

    res.json({
      ...cls,
      teacherName: teacher?.name ?? "",
      studentCount: enrollments.length,
      createdAt: cls.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "joinClass error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/classes/:classId", requireAuth, async (req, res) => {
  const classId = parseInt(req.params.classId ?? "");
  if (isNaN(classId)) {
    res.status(400).json({ error: "Invalid class ID" });
    return;
  }

  try {
    const [cls] = await db
      .select()
      .from(classesTable)
      .where(eq(classesTable.id, classId))
      .limit(1);

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const students = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
      })
      .from(classEnrollmentsTable)
      .innerJoin(usersTable, eq(classEnrollmentsTable.studentId, usersTable.id))
      .where(eq(classEnrollmentsTable.classId, classId));

    const assignments = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.classId, classId));

    const [teacher] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, cls.teacherId))
      .limit(1);

    res.json({
      ...cls,
      teacherName: teacher?.name ?? "",
      createdAt: cls.createdAt.toISOString(),
      students,
      assignments: assignments.map((a) => ({
        ...a,
        className: cls.name,
        dueDate: a.dueDate ? a.dueDate.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "getClass error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
