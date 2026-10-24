import { z } from "zod";
import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/index.ts";
import { StatusCodes } from "http-status-codes";
import { logger } from "../config/index.ts";

const queryValidate = (schema: z.ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
        logger.info("Query validation failed result: " + JSON.stringify(result));
        const errors = result.error.issues.map((error) => ({
            field: error.path.map(String).join("."),
            message: error.message,
        }));
        throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "Please provide valid data", errors);
    }

    req.validatedQuery = result.data;

    next();
};


export default queryValidate;
