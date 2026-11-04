import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import ordersRouter from "./orders";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(ordersRouter);

export default router;
