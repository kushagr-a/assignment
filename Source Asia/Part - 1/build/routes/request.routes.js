import { Router } from "express";
import { createRequest, getStats } from "../controller/request.controller";
const rateLimitRouter = Router();
rateLimitRouter.route("/request").post(createRequest);
rateLimitRouter.route("/stats").get(getStats);
export default rateLimitRouter;
//# sourceMappingURL=request.routes.js.map