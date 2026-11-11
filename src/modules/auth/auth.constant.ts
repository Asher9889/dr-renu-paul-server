export const AUTH_MESSAGES = {
    LOGIN_SUCCESS: "Login successful.",
    LOGOUT_SUCCESS: "Logout successful.",
    TOKEN_REFRESHED: "Token refreshed successfully.",
    INVALID_CREDENTIALS: "Invalid email or password.",
    ACCOUNT_INACTIVE: "Account is inactive. Please contact administrator.",
    ACCOUNT_BLOCKED: "Account has been blocked. Please contact administrator.",
    REFRESH_TOKEN_REQUIRED: "Refresh token is required.",
    INVALID_REFRESH_TOKEN: "Invalid or expired refresh token.",
    GOOGLE_NOT_CONFIGURED: "Google sign-in is not configured.",
    GOOGLE_AUTH_FAILED: "Google sign-in could not be completed.",
    GOOGLE_EMAIL_NOT_VERIFIED: "Your Google email address is not verified.",
} as const;

export const GOOGLE_OAUTH = {
    AUTHORIZATION_URL: "https://accounts.google.com/o/oauth2/v2/auth",
    TOKEN_URL: "https://oauth2.googleapis.com/token",
    USER_INFO_URL: "https://openidconnect.googleapis.com/v1/userinfo",
    SCOPE: "openid email profile",
    STATE_COOKIE: "googleOAuthState",
    // The callback keeps the address already registered with Google, so the
    // cookie must be visible to both /api/v1/auth/google and /api/auth/...
    STATE_COOKIE_PATH: "/api",
    STATE_TTL_SECONDS: 10 * 60,
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