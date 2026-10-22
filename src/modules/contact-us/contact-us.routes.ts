import express from "express";
import schemaValidate from "../../middlewares/schemaValidate.ts";
import { contactUsController } from "./contact-us.module.ts";
import { createContactUsSchema } from "./contact-us.schema.ts";

const router = express.Router();

router.post("/", schemaValidate(createContactUsSchema), contactUsController.createContactUs);

export default router;
