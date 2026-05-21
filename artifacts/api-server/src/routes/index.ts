import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import classesRouter from "./classes";
import assignmentsRouter from "./assignments";
import submissionsRouter from "./submissions";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(classesRouter);
router.use(assignmentsRouter);
router.use(submissionsRouter);
router.use(dashboardRouter);

export default router;
