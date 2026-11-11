import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { envConfig, logger } from "../../config/index.ts";
import { ApiError, ApiResponse } from "../../utils/index.ts";
import { AUTH_MESSAGES, GOOGLE_OAUTH } from "./auth.constant.ts";
import type { AuthService } from "./auth.service.ts";
import type {
    TGoogleAuthQuery,
    TLoginPayload,
    TRefreshTokenPayload,
} from "./auth.types.ts";

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
            const cookieRefreshToken = req.cookies?.refreshToken as string | undefined;
            const bodyRefreshToken = (req.validatedBody as TRefreshTokenPayload).refreshToken;
            const refreshToken = cookieRefreshToken || bodyRefreshToken;

            if (!refreshToken) {
                throw new ApiError(
                    StatusCodes.UNAUTHORIZED,
                    AUTH_MESSAGES.REFRESH_TOKEN_REQUIRED,
                );
            }

            const tokens = await this.authService.refreshToken(refreshToken);

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

    googleStart = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const { redirect } = req.validatedQuery as TGoogleAuthQuery;
            const { url, state } = this.authService.createGoogleAuthRequest(redirect);

            res.cookie(GOOGLE_OAUTH.STATE_COOKIE, state, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: GOOGLE_OAUTH.STATE_COOKIE_PATH,
                maxAge: GOOGLE_OAUTH.STATE_TTL_SECONDS * 1000,
            });

            return res.redirect(url);
        } catch (error) {
            next(error);
        }
    };

    googleCallback = async (
        req: Request,
        res: Response,
    ) => {
        const stateCookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            path: GOOGLE_OAUTH.STATE_COOKIE_PATH,
        };

        const state = typeof req.query.state === "string" ? req.query.state : undefined;
        const stateCookie = req.cookies?.[GOOGLE_OAUTH.STATE_COOKIE] as string | undefined;
        const code = typeof req.query.code === "string" ? req.query.code : undefined;
        const providerError = typeof req.query.error === "string" ? req.query.error : undefined;
        const redirectPath = this.authService.resolveGoogleRedirect(state);

        res.clearCookie(GOOGLE_OAUTH.STATE_COOKIE, stateCookieOptions);

        try {
            if (providerError || !code) {
                throw new ApiError(
                    StatusCodes.BAD_REQUEST,
                    AUTH_MESSAGES.GOOGLE_AUTH_FAILED,
                );
            }

            this.authService.assertGoogleState(state, stateCookie);

            const tokens = await this.authService.loginWithGoogle(code);
            const cookieOptions = this.authService.getCookieOptions(true);

            res.cookie("accessToken", tokens.accessToken, cookieOptions.accessToken);
            res.cookie("refreshToken", tokens.refreshToken, cookieOptions.refreshToken);

            return res.redirect(`${envConfig.google.frontendUrl}${redirectPath}`);
        } catch (error) {
            logger.warn({ err: error }, "Google sign-in failed");

            const params = new URLSearchParams({
                redirect: redirectPath,
                error: "oauth",
            });

            return res.redirect(
                `${envConfig.google.frontendUrl}/login?${params.toString()}`,
            );
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
                    name: user.name ?? null,
                    avatarUrl: user.avatarUrl ?? null,
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