import { v4 as uuidv4 } from "uuid";

import {
    productsStore,
    skuStore
} from "../store/product.store";

import {
    IAddMediaRequest,
    ICreateProductRequest,
    IProduct,
    IProductListItem
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

    // validate name
    if (!name || !name.trim()) {
        throw new Error("Product name is required");
    }

    // validate sku
    if (!sku || !sku.trim()) {
        throw new Error("Product SKU is required");
    }

    // validate duplicate SKU
    if (skuStore.has(sku)) {
        throw new Error("Duplicate SKU");
    }

    // validate image urls
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


// get all products with pagination
export const getAllProductsService = (
    page: number,
    limit: number
) => {

    const products =
        Array.from(productsStore.values());

    const total = products.length;

    const startIndex = (page - 1) * limit;

    const paginatedProducts =
        products.slice(
            startIndex,
            startIndex + limit
        );

    const productList: IProductListItem[] =
        paginatedProducts.map((product) => ({
            id: product.id,

            name: product.name,
            sku: product.sku,

            image_count:
                product.image_urls.length,

            video_count:
                product.video_urls.length,

            thumbnail_url:
                product.image_urls[0] || undefined,

            createdAt: product.createdAt
        }));

    return {
        page,
        limit,
        total,
        products: productList
    };
};

// get product by id
export const getProductByIdService = (
    productId: string
): IProduct => {

    const product =
        productsStore.get(productId);

    if (!product) {
        throw new Error("Product not found");
    }

    return product;
};


// add media to product
export const addMediaToProductService = (
    productId: string,
    payload: IAddMediaRequest
): IProduct => {

    const product =
        productsStore.get(productId);

    if (!product) {
        throw new Error("Product not found");
    }

    const {
        image_urls,
        video_urls
    } = payload;

    const hasImages =
        image_urls && image_urls.length > 0;

    const hasVideos =
        video_urls && video_urls.length > 0;

    if (!hasImages && !hasVideos) {
        throw new Error(
            "At least one image or video URL is required"
        );
    }

    // validate image urls
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

        product.image_urls.push(...image_urls);
    }

    // validate video urls
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

        product.video_urls.push(...video_urls);
    }

    productsStore.set(product.id, product);

    return product;
};