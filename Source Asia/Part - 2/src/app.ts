import express from "express";
import productRouter from "./routes/product.routes";

// import { config } from "./config/config";
// import apiRoutes from "./routes/request.routes";

const app = express();

const config = {
    port: process.env.PORT || 3030
}

// Middleware
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

app.get("/health", (_req, res) => {
    res.status(200).json(
        {
            success: true,
            message: "health check successful",
            time: new Date().toISOString()
        }
    )
});

app.use("/api", productRouter);

const startServer = async (): Promise<void> => {
    try {
        const server = app.listen(config.port, () => {
            console.log(
                ` Server running on http://localhost:${config.port}`
            );
        });

        server.on("error", (error: NodeJS.ErrnoException) => {
            if (error.code === "EADDRINUSE") {
                console.error(` Port ${config.port} is already in use`);
            } else {
                console.error(" Server error:", error.message);
            }

            process.exit(1);
        });

    } catch (error) {
        console.error(" Failed to start server:", error);
        process.exit(1);
    }
};

startServer();
