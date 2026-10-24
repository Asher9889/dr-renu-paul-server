import { z } from "zod";
import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/index.ts";
import { StatusCodes } from "http-status-codes";
import { logger } from "../config/index.ts";

const schemaValidate = (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        logger.info("Schema validation failed result: " + JSON.stringify(result));
        const errors = result.error.issues.map((error) => ({
            field: error.path.map(String).join("."),
            message: error.message,
        }));
        const msgs = errors.map((error) => error.message).join(", ");
        throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, msgs || "Please provide valid data", errors);
    }

    req.validatedBody = result.data;

    next();
};


export default schemaValidate;
