import express from "express";
import cookieParser from "cookie-parser";
import { globalErrorHandler, routeNotExistsHandler } from "./utils/index.ts";
import { connectMongoDB } from "./db/index.ts"
import apiRoutes from "./routes/index.ts";
import { envConfig, logger } from "./config/index.ts";


const app = express();

connectMongoDB()
    .catch((err) => logger.error({ err }, "Failed to restore Telegram listeners"));

// app.use(httpLogger);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());


app.use("/api", apiRoutes);

app.use(routeNotExistsHandler);
app.use(globalErrorHandler);

app.listen(envConfig.port, () => {
    logger.info({ port: envConfig.port}, `App is listening`)
})