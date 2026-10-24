import express from "express";
import schemaValidate from "../../middlewares/schemaValidate.ts";
import paramsValidate from "../../middlewares/paramsValidate.ts";
import queryValidate from "../../middlewares/queryValidate.ts";
import authenticate from "../../middlewares/authenticate.ts";
import authorize from "../../middlewares/authorize.ts";
import { userController } from "./user.module.ts";
import {
    createUserSchema,
    updateUserSchema,
    userParamsSchema,
    userListQuerySchema,
} from "./user.schema.ts";
import { USER_ROLE } from "./user.constant.ts";

const userRoutes = express.Router();

userRoutes.use(authenticate);
userRoutes.use(authorize(USER_ROLE.SUPER_ADMIN));

userRoutes.get("/", queryValidate(userListQuerySchema), userController.getUsers);
userRoutes.post("/", schemaValidate(createUserSchema), userController.createUser);
userRoutes.get("/:id", paramsValidate(userParamsSchema), userController.getUser);
userRoutes.patch("/:id", paramsValidate(userParamsSchema), schemaValidate(updateUserSchema), userController.updateUser);
userRoutes.delete("/:id", paramsValidate(userParamsSchema), userController.deleteUser);

export { userRoutes };