import { Request, Response } from "express";

import { createProductService } from "../service/product.service";
import { ICreateProductRequest } from "../types/product.types";

export const createProduct = (
    req: Request,
    res: Response
): void => {

    try {

        const payload: ICreateProductRequest = req.body;

        const product =
            createProductService(payload);

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: product
        });

    } catch (error) {

        const message =
            error instanceof Error
                ? error.message
                : "Internal Server Error";

        // Duplicate SKU
        if (message === "Duplicate SKU") {

            res.status(409).json({
                success: false,
                message
            });

            return;
        }

        // Validation errors
        if (
            message.includes("required") ||
            message.includes("Invalid") ||
            message.includes("Maximum")
        ) {

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