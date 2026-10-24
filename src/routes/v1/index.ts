import express from "express";
import { contactUsRoutes } from "../../modules/contact-us/index.ts";
import { blogAdminRoutes, blogRoutes } from "../../modules/blog/index.ts";
import { authRoutes } from "../../modules/auth/index.ts";
import { userRoutes } from "../../modules/user/index.ts";

const router = express.Router();

router.use("/contact-us", contactUsRoutes);
router.use("/blog", blogRoutes);
router.use("/admin/blog", blogAdminRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);

export default router;