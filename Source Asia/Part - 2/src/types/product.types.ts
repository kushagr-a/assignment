export interface IProduct {
    id: string;

    name: string;
    sku: string;

    image_urls: string[];
    video_urls: string[];

    createdAt: Date;
}

export interface ICreateProductRequest {
    name: string;
    sku: string;

    image_urls?: string[];
    video_urls?: string[];
}

export interface IAddMediaRequest {
    image_urls?: string[];
    video_urls?: string[];
}

export interface IProductListItem {
    id: string;

    name: string;
    sku: string;

    image_count: number;
    video_count: number;

    thumbnail_url?: string;

    createdAt: Date;
}

export type ProductStore = Map<string, IProduct>;

export type SkuStore = Map<string, string>;