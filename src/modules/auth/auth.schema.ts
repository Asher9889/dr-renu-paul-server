import { z } from "zod";

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
    rememberMe: z.boolean().optional().default(false),
}).strict();

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1, "Refresh token is required").optional(),
}).strict();

export const logoutSchema = z.object({}).strict();

export const googleAuthQuerySchema = z.object({
    redirect: z.string().trim().optional(),
}).strict();