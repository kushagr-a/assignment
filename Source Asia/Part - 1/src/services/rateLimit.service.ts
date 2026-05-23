// rolling window logic

import { rateLimitStore } from "../store/memory.store";
import { RateLimitStore } from "../types/types.request";

export class RateLimitService {
    private store: RateLimitStore;
    private maxRequests: number;

    private readonly WINDOW_SIZE = 60 * 1000; // 1 minute

    constructor(maxRequests: number) {
        this.store = rateLimitStore;
        this.maxRequests = maxRequests;
    }

    isAllowed(userId: string): boolean {

        const currentTime = Date.now();

        const userStats = this.store.get(userId) || {
            acceptedRequests: 0,
            rejectedRequests: 0,
            requestTimestamps: []
        };

        // remove old timestamps outside rolling window
        userStats.requestTimestamps =
            userStats.requestTimestamps.filter(
                (timestamp) =>
                    currentTime - timestamp < this.WINDOW_SIZE
            );

        // check limit
        if (userStats.requestTimestamps.length < this.maxRequests) {

            userStats.requestTimestamps.push(currentTime);

            userStats.acceptedRequests =
                userStats.requestTimestamps.length;

            this.store.set(userId, userStats);

            return true;
        }

        // rejected request
        userStats.rejectedRequests += 1;

        this.store.set(userId, userStats);

        return false;
    }
}