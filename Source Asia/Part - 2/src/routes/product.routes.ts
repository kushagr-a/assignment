import { Router } from "express";

const productRouter = Router();

productRouter.route("/createProduct").post();

productRouter.route("/getAllProducts").get();

productRouter.route("/getProductById").get();

productRouter.route("/:id/media").post();


export default productRouter;