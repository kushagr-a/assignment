import { Request, Response } from "express";

import { RateLimitService } from "../services/rateLimit.service";
import { rateLimitStore } from "../store/memory.store";

const rateLimitService = new RateLimitService(5);

export const createRequest = (
    req: Request,
    res: Response
): void => {

    const { user_id, payload } = req.body;

    // basic validation
    if (
        !user_id ||
        typeof user_id !== "string" ||
        payload === undefined
    ) {
        res.status(400).json({
            success: false,
            message: "Invalid request body"
        });

        return;
    }

    const isAllowed =
        rateLimitService.isAllowed(user_id);

    // rate limit exceeded
    if (!isAllowed) {

        res.status(429).json({
            success: false,
            message: "Rate limit exceeded. Max 5 requests per minute allowed."
        });

        return;
    }

    // success
    res.status(201).json({
        success: true,
        message: "Request accepted"
    });
};


export const getStats = (
    _req: Request,
    res: Response
): void => {

    const stats = Array.from(
        rateLimitStore.entries()
    ).map(([userId, userStats]) => ({
        user_id: userId,
        accepted_requests:
            userStats.acceptedRequests,

        rejected_requests:
            userStats.rejectedRequests,

        current_window_requests:
            userStats.requestTimestamps.length
    }));

    res.status(200).json({
        success: true,
        data: stats
    });
};