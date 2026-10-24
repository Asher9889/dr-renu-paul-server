import { StatusCodes } from "http-status-codes";
import { ApiError, ApiResponse } from "../index.ts";
import { NextFunction, Request, Response } from "express";
import { logger } from "../../config/index.ts";

export default function globalErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
    if (err instanceof ApiError) {
        return ApiResponse.error(res, err.statusCode, err.message, err.errors);
    }

    const multerError = err as Error & { name?: string; code?: string };

    if (multerError.name === "MulterError") {
        const isTooLarge = multerError.code === "LIMIT_FILE_SIZE";
        const message = isTooLarge
            ? "Image must be 8 MB or smaller."
            : "The file could not be uploaded.";

        return ApiResponse.error(
            res,
            isTooLarge ? StatusCodes.REQUEST_TOO_LONG : StatusCodes.BAD_REQUEST,
            message,
            [{ field: "file", message }],
        );
    }

    const syntaxError = err as Error & { status?: number; type?: string };

    if (err instanceof SyntaxError && syntaxError.status === 400) {
        return ApiResponse.error(
            res,
            StatusCodes.BAD_REQUEST,
            "The request body contains invalid JSON.",
            [{ field: "body", message: "Please provide a valid JSON body." }],
        );
    }

    logger.error({ err, method: req.method, path: req.path }, "Unhandled request error");

    return ApiResponse.error(res, StatusCodes.INTERNAL_SERVER_ERROR, err.message);
}
