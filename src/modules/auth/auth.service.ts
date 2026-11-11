import jwt from "jsonwebtoken";
import ms from "ms";
import type { StringValue } from "ms";
import { envConfig, logger } from "../../config/index.ts";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "../../utils/index.ts";
import { AUTH_MESSAGES, GOOGLE_OAUTH } from "./auth.constant.ts";
import { ACCOUNT_STATUS } from "../user/user.constant.ts";
import type { UserService } from "../user/user.service.ts";
import { UserModel } from "../user/user.model.ts";
import type {
    TLoginPayload,
    TAuthTokens,
    TAccessTokenPayload,
    TGoogleProfile,
    TRefreshTokenPayloadDecoded,
} from "./auth.types.ts";

type TGoogleTokenResponse = {
    access_token?: string;
};

type TGoogleUserInfoResponse = {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
};

/**
 * Only same-origin paths may be used as a post-sign-in destination.
 */
function sanitizeRedirectPath(value: unknown): string {
    if (
        typeof value !== "string" ||
        !value.startsWith("/") ||
        value.startsWith("//") ||
        value.includes("\\")
    ) {
        return "/";
    }

    if (value === "/login" || value.startsWith("/login?")) {
        return "/";
    }

    return value;
}

function decodeGoogleState(state?: string): { redirect: string } | null {
    if (!state) return null;

    try {
        const decoded = jwt.verify(state, envConfig.jwtConfig.accessTokenSecret);

        if (typeof decoded === "string" || decoded.type !== "google_oauth_state") {
            return null;
        }

        return { redirect: sanitizeRedirectPath(decoded.redirect) };
    } catch {
        return null;
    }
}

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

        if (user.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                user.accountStatus === ACCOUNT_STATUS.BLOCKED
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

    /**
     * Builds the Google consent URL and the signed state that ties the callback
     * back to this browser and to the page the reader came from.
     */
    createGoogleAuthRequest(redirectParam?: string): { url: string; state: string } {
        if (!envConfig.google.clientId || !envConfig.google.clientSecret) {
            throw new ApiError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                AUTH_MESSAGES.GOOGLE_NOT_CONFIGURED,
            );
        }

        const state = jwt.sign(
            {
                type: "google_oauth_state",
                redirect: sanitizeRedirectPath(redirectParam),
            },
            envConfig.jwtConfig.accessTokenSecret,
            { expiresIn: GOOGLE_OAUTH.STATE_TTL_SECONDS },
        );

        const searchParams = new URLSearchParams({
            client_id: envConfig.google.clientId,
            redirect_uri: envConfig.google.redirectUri,
            response_type: "code",
            scope: GOOGLE_OAUTH.SCOPE,
            state,
            access_type: "online",
            prompt: "select_account",
        });

        return {
            url: `${GOOGLE_OAUTH.AUTHORIZATION_URL}?${searchParams.toString()}`,
            state,
        };
    }

    resolveGoogleRedirect(state?: string): string {
        return decodeGoogleState(state)?.redirect ?? "/";
    }

    assertGoogleState(state?: string, cookieState?: string): void {
        if (!state || !cookieState || state !== cookieState || !decodeGoogleState(state)) {
            throw new ApiError(
                StatusCodes.BAD_REQUEST,
                AUTH_MESSAGES.GOOGLE_AUTH_FAILED,
            );
        }
    }

    async loginWithGoogle(code: string): Promise<TAuthTokens> {
        const googleAccessToken = await this.exchangeGoogleCode(code);
        const profile = await this.fetchGoogleProfile(googleAccessToken);
        const user = await this.userService.findOrCreateGoogleUser(profile);

        if (user.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                user.accountStatus === ACCOUNT_STATUS.BLOCKED
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

        // Google readers stay signed in across visits without a password.
        return this.generateTokens(accessTokenPayload, true);
    }

    private async exchangeGoogleCode(code: string): Promise<string> {
        const response = await fetch(GOOGLE_OAUTH.TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: envConfig.google.clientId,
                client_secret: envConfig.google.clientSecret,
                redirect_uri: envConfig.google.redirectUri,
                grant_type: "authorization_code",
            }),
            signal: AbortSignal.timeout(10_000),
        });

        const payload = (await response.json()) as TGoogleTokenResponse;

        if (!response.ok || !payload.access_token) {
            logger.warn({ status: response.status }, "Google token exchange failed");
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                AUTH_MESSAGES.GOOGLE_AUTH_FAILED,
            );
        }

        return payload.access_token;
    }

    private async fetchGoogleProfile(accessToken: string): Promise<TGoogleProfile> {
        const response = await fetch(GOOGLE_OAUTH.USER_INFO_URL, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
            logger.warn({ status: response.status }, "Google profile lookup failed");
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                AUTH_MESSAGES.GOOGLE_AUTH_FAILED,
            );
        }

        const payload = (await response.json()) as TGoogleUserInfoResponse;
        const email = payload.email?.trim().toLowerCase();

        if (!payload.sub || !email) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                AUTH_MESSAGES.GOOGLE_AUTH_FAILED,
            );
        }

        if (!payload.email_verified) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                AUTH_MESSAGES.GOOGLE_EMAIL_NOT_VERIFIED,
            );
        }

        return {
            googleId: payload.sub,
            email,
            name: payload.name?.trim() || undefined,
            avatarUrl: payload.picture?.trim() || undefined,
        };
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

        if (!user || user.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
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