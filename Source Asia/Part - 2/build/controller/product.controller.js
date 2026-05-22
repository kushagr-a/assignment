import { addMediaToProductService, createProductService, getAllProductsService, getProductByIdService } from "../service/product.service";
export const createProduct = (req, res) => {
    try {
        const payload = req.body;
        const product = createProductService(payload);
        res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: product
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Internal Server Error";
        if (message === "Duplicate SKU") {
            res.status(409).json({
                success: false,
                message
            });
            return;
        }
        if (message.includes("required") ||
            message.includes("Invalid") ||
            message.includes("Maximum")) {
            res.status(400).json({
                success: false,
                message
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};
export const getAllProducts = (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        if (page < 1 ||
            limit < 1 ||
            limit > 50) {
            res.status(400).json({
                success: false,
                message: "Invalid pagination values"
            });
            return;
        }
        const result = getAllProductsService(page, limit);
        res.status(200).json({
            success: true,
            ...result
        });
    }
    catch {
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};
export const getProductById = (req, res) => {
    try {
        const id = req.params.id;
        if (!id) {
            res.status(400).json({
                success: false,
                message: "Invalid product id"
            });
            return;
        }
        const product = getProductByIdService(id);
        res.status(200).json({
            success: true,
            data: product
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Internal Server Error";
        if (message ===
            "Product not found") {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};
export const addProductMedia = (req, res) => {
    try {
        const id = req.params.id;
        if (!id) {
            res.status(400).json({
                success: false,
                message: "Invalid product id"
            });
            return;
        }
        const updatedProduct = addMediaToProductService(id, req.body);
        res.status(200).json({
            success: true,
            message: "Media added successfully",
            data: updatedProduct
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Internal Server Error";
        if (message ===
            "Product not found") {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }
        if (message.includes("Invalid") ||
            message.includes("Maximum") ||
            message.includes("required")) {
            res.status(400).json({
                success: false,
                message
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};
//# sourceMappingURL=product.controller.js.map