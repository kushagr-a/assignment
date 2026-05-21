import { v4 as uuidv4 } from "uuid";

import {
    productsStore,
    skuStore
} from "../store/product.store";

import {
    ICreateProductRequest,
    IProduct
} from "../types/product.types";

const isValidUrl = (url: string): boolean => {
    return (
        url.startsWith("http://") ||
        url.startsWith("https://")
    );
};

export const createProductService = (
    payload: ICreateProductRequest
): IProduct => {

    const {
        name,
        sku,
        image_urls,
        video_urls
    } = payload;

    // Validate name
    if (!name || !name.trim()) {
        throw new Error("Product name is required");
    }

    // Validate sku
    if (!sku || !sku.trim()) {
        throw new Error("Product SKU is required");
    }

    // Duplicate SKU
    if (skuStore.has(sku)) {
        throw new Error("Duplicate SKU");
    }

    // Validate image urls
    if (image_urls) {

        if (image_urls.length > 20) {
            throw new Error(
                "Maximum 20 image URLs allowed"
            );
        }

        for (const url of image_urls) {

            if (!isValidUrl(url)) {
                throw new Error(
                    "Invalid image URL"
                );
            }
        }
    }

    // Validate video urls
    if (video_urls) {

        if (video_urls.length > 20) {
            throw new Error(
                "Maximum 20 video URLs allowed"
            );
        }

        for (const url of video_urls) {

            if (!isValidUrl(url)) {
                throw new Error(
                    "Invalid video URL"
                );
            }
        }
    }

    // Create product
    const product: IProduct = {
        id: uuidv4(),

        name: name.trim(),
        sku: sku.trim(),

        image_urls: image_urls ?? [],
        video_urls: video_urls ?? [],

        createdAt: new Date()
    };

    // Store product
    productsStore.set(product.id, product);

    // Store sku reference
    skuStore.set(product.sku, product.id);

    return product;
};

// get all products service
export const getAllProductsService = () => {

}

// get product by id service
export const getProductByIdService = () => {

}

// add media to product service
export const addMediaToProductService = () => {

}
