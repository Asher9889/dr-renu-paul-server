import express from "express";
import schemaValidate from "../../middlewares/schemaValidate.ts";
import authenticate from "../../middlewares/authenticate.ts";
import { authController } from "./auth.module.ts";
import { loginSchema, refreshTokenSchema, logoutSchema } from "./auth.schema.ts";

const authRoutes = express.Router();

authRoutes.post("/login", schemaValidate(loginSchema), authController.login);
authRoutes.post("/refresh", schemaValidate(refreshTokenSchema), authController.refresh);
authRoutes.post("/logout", schemaValidate(logoutSchema), authController.logout);
authRoutes.get("/me", authenticate, authController.me);

export { authRoutes };