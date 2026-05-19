export interface IUserRequest {
    user_id: string;
    payload: unknown;
}

export interface IUserStats {
    acceptedRequests: number;
    rejectedRequests: number;
    requestTimestamps: number[];
}

export type RateLimitStore = Map<string, IUserStats>;