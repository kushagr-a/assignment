import { Router } from "express";
import { addProductMedia, createProduct, getAllProducts, getProductById } from "../controller/product.controller";

const productRouter = Router();

productRouter.route("/createProduct").post(createProduct);

productRouter.route("/getAllProducts").get(getAllProducts);

productRouter.route("/getProductById/:id").get(getProductById);

productRouter.route("/:id/media").post(addProductMedia);


export default productRouter;