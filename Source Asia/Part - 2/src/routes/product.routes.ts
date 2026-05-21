import { Router } from "express";
import { createProduct } from "../controller/product.controller";

const productRouter = Router();

productRouter.route("/createProduct").post(createProduct);

// productRouter.route("/getAllProducts").get();

// productRouter.route("/getProductById").get();

// productRouter.route("/:id/media").post();


export default productRouter;