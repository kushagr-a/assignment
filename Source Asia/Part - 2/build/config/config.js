import dotenv from "dotenv";
dotenv.config();
export const config = Object.freeze({
    port: Number(process.env.PORT) || 4000
});
//# sourceMappingURL=config.js.map