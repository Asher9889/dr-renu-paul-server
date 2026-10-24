import { AuthService } from "./auth.service.ts";
import { AuthController } from "./auth.controller.ts";
import { userService } from "../user/user.module.ts";

const authService = new AuthService(userService);
const authController = new AuthController(authService);

export { authService, authController };