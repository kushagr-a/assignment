import { rateLimitStore } from "../store/memory.store";
export class RateLimitService {
    store;
    maxRequests;
    WINDOW_SIZE = 60 * 1000;
    constructor(maxRequests) {
        this.store = rateLimitStore;
        this.maxRequests = maxRequests;
    }
    isAllowed(userId) {
        const currentTime = Date.now();
        const userStats = this.store.get(userId) || {
            acceptedRequests: 0,
            rejectedRequests: 0,
            requestTimestamps: []
        };
        userStats.requestTimestamps =
            userStats.requestTimestamps.filter((timestamp) => currentTime - timestamp < this.WINDOW_SIZE);
        if (userStats.requestTimestamps.length < this.maxRequests) {
            userStats.requestTimestamps.push(currentTime);
            userStats.acceptedRequests =
                userStats.requestTimestamps.length;
            this.store.set(userId, userStats);
            return true;
        }
        userStats.rejectedRequests += 1;
        this.store.set(userId, userStats);
        return false;
    }
}
//# sourceMappingURL=rateLimit.service.js.map