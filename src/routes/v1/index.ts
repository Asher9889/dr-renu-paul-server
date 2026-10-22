import express from "express";
import { contactUsRoutes } from "../../modules/contact-us/index.ts";

const router = express.Router();

router.use("/contact-us", contactUsRoutes);

export default router;