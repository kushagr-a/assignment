import { RateLimitService } from "../services/rateLimit.service";
import { rateLimitStore } from "../store/memory.store";
const rateLimitService = new RateLimitService(5);
export const createRequest = (req, res) => {
    const { user_id, payload } = req.body;
    if (!user_id ||
        typeof user_id !== "string" ||
        payload === undefined) {
        res.status(400).json({
            success: false,
            message: "Invalid request body"
        });
        return;
    }
    const isAllowed = rateLimitService.isAllowed(user_id);
    if (!isAllowed) {
        res.status(429).json({
            success: false,
            message: "Rate limit exceeded. Max 5 requests per minute allowed."
        });
        return;
    }
    res.status(201).json({
        success: true,
        message: "Request accepted"
    });
};
export const getStats = (_req, res) => {
    const stats = Array.from(rateLimitStore.entries()).map(([userId, userStats]) => ({
        user_id: userId,
        accepted_requests: userStats.acceptedRequests,
        rejected_requests: userStats.rejectedRequests,
        current_window_requests: userStats.requestTimestamps.length
    }));
    res.status(200).json({
        success: true,
        data: stats
    });
};
//# sourceMappingURL=request.controller.js.map