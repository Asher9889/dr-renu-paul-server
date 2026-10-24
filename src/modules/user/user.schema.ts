import { z } from "zod";
import { USER_ROLE, ACCOUNT_STATUS } from "./user.constant.ts";

const objectIdSchema = z.string().refine(
    (val) => /^[0-9a-fA-F]{24}$/.test(val),
    "Invalid ObjectId format",
);

export const createUserSchema = z.object({
    email: z.string().trim().toLowerCase().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    role: z.enum(Object.values(USER_ROLE) as [string, ...string[]]).default(USER_ROLE.USER),
    accountStatus: z.enum(Object.values(ACCOUNT_STATUS) as [string, ...string[]]).default(ACCOUNT_STATUS.ACTIVE),
}).strict();

export const updateUserSchema = createUserSchema.partial().strict();

export const userParamsSchema = z.object({
    id: objectIdSchema,
});

export const userListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    role: z.enum(Object.values(USER_ROLE) as [string, ...string[]]).optional(),
    accountStatus: z.enum(Object.values(ACCOUNT_STATUS) as [string, ...string[]]).optional(),
}).strict();

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
}).strict();

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
}).strict();