export const AUTH_MESSAGES = {
    LOGIN_SUCCESS: "Login successful.",
    LOGOUT_SUCCESS: "Logout successful.",
    TOKEN_REFRESHED: "Token refreshed successfully.",
    INVALID_CREDENTIALS: "Invalid email or password.",
    ACCOUNT_INACTIVE: "Account is inactive. Please contact administrator.",
    ACCOUNT_BLOCKED: "Account has been blocked. Please contact administrator.",
    REFRESH_TOKEN_REQUIRED: "Refresh token is required.",
    INVALID_REFRESH_TOKEN: "Invalid or expired refresh token.",
} as const;

export const COOKIE_OPTIONS = {
    accessToken: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 15 * 60 * 1000, // 15 minutes
    },
    refreshToken: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
} as const;