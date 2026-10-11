import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import demandsRouter from "./demands";
import commentsRouter from "./comments";
import confirmationsRouter from "./confirmations";
import categoriesRouter from "./categories";
import neighborhoodsRouter from "./neighborhoods";
import serviceOrdersRouter from "./service_orders";
import teamsRouter from "./teams";
import departmentsRouter from "./departments";
import publicWorksRouter from "./public_works";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import attachmentsRouter from "./attachments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(demandsRouter);
router.use(commentsRouter);
router.use(confirmationsRouter);
router.use(categoriesRouter);
router.use(neighborhoodsRouter);
router.use(serviceOrdersRouter);
router.use(teamsRouter);
router.use(departmentsRouter);
router.use(publicWorksRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(attachmentsRouter);

export default router;
