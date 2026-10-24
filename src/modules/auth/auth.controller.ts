import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ApiResponse } from "../../utils/index.ts";
import { AUTH_MESSAGES } from "./auth.constant.ts";
import type { AuthService } from "./auth.service.ts";
import type { TLoginPayload, TRefreshTokenPayload } from "./auth.types.ts";

export class AuthController {
    private readonly authService: AuthService;

    constructor(authService: AuthService) {
        this.authService = authService;
    }

    login = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const payload = req.validatedBody as TLoginPayload;
            const { user, tokens } = await this.authService.login(payload);

            const cookieOptions = this.authService.getCookieOptions(payload.rememberMe);

            res.cookie("accessToken", tokens.accessToken, cookieOptions.accessToken);
            res.cookie("refreshToken", tokens.refreshToken, cookieOptions.refreshToken);

            return ApiResponse.success(
                res,
                StatusCodes.OK,
                AUTH_MESSAGES.LOGIN_SUCCESS,
                { user },
            );
        } catch (error) {
            next(error);
        }
    };

    refresh = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const refreshToken = req.cookies.refreshToken;

            if (!refreshToken) {
                const payload = req.validatedBody as TRefreshTokenPayload;
                if (!payload.refreshToken) {
                    throw new Error("Refresh token is required");
                }
            }

            const token = refreshToken || (req.validatedBody as TRefreshTokenPayload).refreshToken;
            const tokens = await this.authService.refreshToken(token);

            const cookieOptions = this.authService.getCookieOptions(false);

            res.cookie("accessToken", tokens.accessToken, cookieOptions.accessToken);
            res.cookie("refreshToken", tokens.refreshToken, cookieOptions.refreshToken);

            return ApiResponse.success(
                res,
                StatusCodes.OK,
                AUTH_MESSAGES.TOKEN_REFRESHED,
                {},
            );
        } catch (error) {
            next(error);
        }
    };

    logout = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const clearOptions = this.authService.getClearCookieOptions();

            res.clearCookie("accessToken", clearOptions);
            res.clearCookie("refreshToken", clearOptions);

            return ApiResponse.success(
                res,
                StatusCodes.OK,
                AUTH_MESSAGES.LOGOUT_SUCCESS,
                {},
            );
        } catch (error) {
            next(error);
        }
    };

    me = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const user = req.validatedUser;

            return ApiResponse.success(
                res,
                StatusCodes.OK,
                "Current user fetched successfully.",
                {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    accountStatus: user.accountStatus,
                    lastLoginAt: user.lastLoginAt,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                },
            );
        } catch (error) {
            next(error);
        }
    };
}