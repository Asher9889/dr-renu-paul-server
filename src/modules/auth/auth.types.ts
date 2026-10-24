import { z } from "zod";
import type {
    loginSchema,
    refreshTokenSchema,
    logoutSchema,
} from "./auth.schema.ts";
import type { TUserRole } from "../user/user.types.ts";

export type TLoginPayload = z.infer<typeof loginSchema>;
export type TRefreshTokenPayload = z.infer<typeof refreshTokenSchema>;
export type TLogoutPayload = z.infer<typeof logoutSchema>;

export type TAccessTokenPayload = {
    id: string;
    email: string;
    role: TUserRole;
};

export type TRefreshTokenPayloadDecoded = {
    id: string;
    email: string;
    type: "refresh";
};

export type TAuthTokens = {
    accessToken: string;
    refreshToken: string;
};

export { AUTH_MESSAGES, COOKIE_OPTIONS } from "./auth.constant.ts";