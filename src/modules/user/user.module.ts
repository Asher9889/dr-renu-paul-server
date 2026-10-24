import { UserService } from "./user.service.ts";
import { UserController } from "./user.controller.ts";

const userService = new UserService();
const userController = new UserController(userService);

export { userService, userController };