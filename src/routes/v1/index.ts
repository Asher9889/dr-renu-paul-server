import express from "express";
import { contactUsRoutes } from "../../modules/contact-us/index.ts";
import { blogAdminRoutes, blogRoutes } from "../../modules/blog/index.ts";

const router = express.Router();

router.use("/contact-us", contactUsRoutes);
router.use("/blog", blogRoutes);
router.use("/admin/blog", blogAdminRoutes);

export default router;