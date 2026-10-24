import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ApiError, ApiResponse } from "../../utils/index.ts";
import { USER_MESSAGES } from "./user.constant.ts";
import type { UserService } from "./user.service.ts";
import type {
    TCreateUserPayload,
    TUpdateUserPayload,
    TUserParams,
    TUserRole,
    TAccountStatus,
} from "./user.types.ts";

export class UserController {
    private readonly userService: UserService;

    constructor(userService: UserService) {
        this.userService = userService;
    }

    createUser = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const payload = req.validatedBody as TCreateUserPayload;
            const user = await this.userService.createUser(payload);

            return ApiResponse.success(
                res,
                StatusCodes.CREATED,
                USER_MESSAGES.USER_CREATED,
                user,
            );
        } catch (error) {
            next(error);
        }
    };

    getUsers = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const page = Number(req.query.page) || 1;
            const limit = Math.min(Number(req.query.limit) || 20, 100);
            const role = req.query.role as TUserRole | undefined;
            const accountStatus = req.query.accountStatus as TAccountStatus | undefined;

            const result = await this.userService.getUsers(page, limit, role, accountStatus);

            return ApiResponse.success(
                res,
                StatusCodes.OK,
                USER_MESSAGES.USERS_FETCHED,
                result.data,
                result.meta,
            );
        } catch (error) {
            next(error);
        }
    };

    getUser = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const { id } = req.validatedParams as TUserParams;
            const user = await this.userService.getUserById(id);

            return ApiResponse.success(
                res,
                StatusCodes.OK,
                USER_MESSAGES.USER_FETCHED,
                user,
            );
        } catch (error) {
            next(error);
        }
    };

    updateUser = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const { id } = req.validatedParams as TUserParams;
            const payload = req.validatedBody as TUpdateUserPayload;
            const user = await this.userService.updateUser(id, payload);

            return ApiResponse.success(
                res,
                StatusCodes.OK,
                USER_MESSAGES.USER_UPDATED,
                user,
            );
        } catch (error) {
            next(error);
        }
    };

    deleteUser = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const { id } = req.validatedParams as TUserParams;
            await this.userService.deleteUser(id);

            return ApiResponse.noContent(res);
        } catch (error) {
            next(error);
        }
    };
}