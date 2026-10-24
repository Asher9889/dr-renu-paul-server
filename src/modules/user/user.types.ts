import { z } from "zod";
import type {
    createUserSchema,
    updateUserSchema,
    userParamsSchema,
    loginSchema,
    refreshTokenSchema,
} from "./user.schema.ts";
import type { USER_ROLE, ACCOUNT_STATUS } from "./user.constant.ts";

export type TUserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];
export type TAccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

export interface IUser {
    id: string;
    email: string;
    password: string;
    role: TUserRole;
    accountStatus: TAccountStatus;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserWithoutPassword extends Omit<IUser, "password"> { }

export type TCreateUserPayload = z.infer<typeof createUserSchema>;
export type TUpdateUserPayload = z.infer<typeof updateUserSchema>;
export type TUserParams = z.infer<typeof userParamsSchema>;
export type TLoginPayload = z.infer<typeof loginSchema>;
export type TRefreshTokenPayload = z.infer<typeof refreshTokenSchema>;

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

export { USER_ROLE, ACCOUNT_STATUS, USER_MESSAGES } from "./user.constant.ts";