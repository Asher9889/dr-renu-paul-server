import express from "express";
import cookieParser from "cookie-parser";
import { globalErrorHandler, routeNotExistsHandler } from "./utils/index.ts";
import { connectMongoDB } from "./db/index.ts"
import apiRoutes from "./routes/index.ts";
import { envConfig, logger } from "./config/index.ts";
import { bookProcessingService } from "./modules/book/index.ts";


const app = express();

connectMongoDB()
    .then(() => {
        bookProcessingService.start();
    })
    .catch((err) => logger.error({ err }, "Failed to connect to MongoDB"));

// app.use(httpLogger);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());


app.use("/api", apiRoutes);

app.use(routeNotExistsHandler);
app.use(globalErrorHandler);

app.listen(envConfig.port, () => {
    logger.info({ port: envConfig.port}, `App is listening`)
})