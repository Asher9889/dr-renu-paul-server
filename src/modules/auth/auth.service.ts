import jwt from "jsonwebtoken";
import ms from "ms";
import type { StringValue } from "ms";
import { envConfig } from "../../config/index.ts";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "../../utils/index.ts";
import { AUTH_MESSAGES } from "./auth.constant.ts";
import type { UserService } from "../user/user.service.ts";
import { UserModel } from "../user/user.model.ts";
import type {
    TLoginPayload,
    TAuthTokens,
    TAccessTokenPayload,
    TRefreshTokenPayloadDecoded,
} from "./auth.types.ts";

function parseDurationToSeconds(duration: string): number {
    const parsed = ms(duration as StringValue);
    if (typeof parsed !== "number") return 15 * 60;
    return Math.floor(parsed / 1000);
}

const accessTokenMaxAgeSeconds = parseDurationToSeconds(
    process.env.JWT_ACCESS_TOKEN_MAX_AGE || "15m",
);

const refreshTokenMaxAgeSeconds = parseDurationToSeconds(
    process.env.JWT_REFRESH_TOKEN_MAX_AGE || "7d",
);

const accessTokenMaxAgeMs = accessTokenMaxAgeSeconds * 1000;
const refreshTokenMaxAgeMs = refreshTokenMaxAgeSeconds * 1000;

export class AuthService {
    private readonly userService: UserService;

    constructor(userService: UserService) {
        this.userService = userService;
    }

    async login(payload: TLoginPayload): Promise<{ user: TAccessTokenPayload; tokens: TAuthTokens }> {
        const user = await this.userService.getUserByEmail(payload.email);

        if (!user) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                AUTH_MESSAGES.INVALID_CREDENTIALS,
                [{ field: "email", message: AUTH_MESSAGES.INVALID_CREDENTIALS }],
            );
        }

        // Get the full document with methods for password comparison
        const userDoc = await UserModel.findById(user.id).select("+password");
        if (!userDoc) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                AUTH_MESSAGES.INVALID_CREDENTIALS,
                [{ field: "email", message: AUTH_MESSAGES.INVALID_CREDENTIALS }],
            );
        }

        const isPasswordValid = await userDoc.comparePassword(payload.password);

        if (!isPasswordValid) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                AUTH_MESSAGES.INVALID_CREDENTIALS,
                [{ field: "password", message: AUTH_MESSAGES.INVALID_CREDENTIALS }],
            );
        }

        if (user.accountStatus !== "active") {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                user.accountStatus === "blocked"
                    ? AUTH_MESSAGES.ACCOUNT_BLOCKED
                    : AUTH_MESSAGES.ACCOUNT_INACTIVE,
            );
        }

        await this.userService.updateLastLogin(user.id);

        const accessTokenPayload: TAccessTokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
        };

        const tokens = this.generateTokens(accessTokenPayload, payload.rememberMe);

        return { user: accessTokenPayload, tokens };
    }

    async refreshToken(refreshToken: string): Promise<TAuthTokens> {
        if (!refreshToken) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                AUTH_MESSAGES.REFRESH_TOKEN_REQUIRED,
            );
        }

        let decoded: TRefreshTokenPayloadDecoded;

        try {
            decoded = jwt.verify(
                refreshToken,
                envConfig.jwtConfig.refreshTokenSecret,
            ) as TRefreshTokenPayloadDecoded;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new ApiError(
                    StatusCodes.UNAUTHORIZED,
                    "Refresh token has expired",
                );
            }
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                AUTH_MESSAGES.INVALID_REFRESH_TOKEN,
            );
        }

        if (decoded.type !== "refresh") {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                AUTH_MESSAGES.INVALID_REFRESH_TOKEN,
            );
        }

        const user = await this.userService.getUserById(decoded.id);

        if (!user || user.accountStatus !== "active") {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                AUTH_MESSAGES.INVALID_REFRESH_TOKEN,
            );
        }

        const accessTokenPayload: TAccessTokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
        };

        return this.generateTokens(accessTokenPayload, false);
    }

    private generateTokens(
        payload: TAccessTokenPayload,
        rememberMe: boolean,
    ): TAuthTokens {
        const accessToken = jwt.sign(
            payload,
            envConfig.jwtConfig.accessTokenSecret,
            {
                expiresIn: accessTokenMaxAgeSeconds,
            },
        );

        const refreshTokenPayload: TRefreshTokenPayloadDecoded = {
            id: payload.id,
            email: payload.email,
            type: "refresh",
        };

        const refreshTokenExpirySeconds = rememberMe
            ? parseDurationToSeconds("30d")
            : refreshTokenMaxAgeSeconds;

        const refreshToken = jwt.sign(
            refreshTokenPayload,
            envConfig.jwtConfig.refreshTokenSecret,
            {
                expiresIn: refreshTokenExpirySeconds,
            },
        );

        return { accessToken, refreshToken };
    }

    getCookieOptions(rememberMe = false) {
        return {
            accessToken: {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax" as const,
                maxAge: accessTokenMaxAgeMs,
            },
            refreshToken: {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax" as const,
                maxAge: rememberMe
                    ? 30 * 24 * 60 * 60 * 1000
                    : refreshTokenMaxAgeMs,
            },
        };
    }

    getClearCookieOptions() {
        return {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            maxAge: 0,
        };
    }
}