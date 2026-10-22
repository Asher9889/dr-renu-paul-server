import { z } from "zod";
import {
  contactUsParamsSchema,
  createContactUsSchema,
} from "./contact-us.schema.ts";

export type TCreateContactUsPayload = z.infer<typeof createContactUsSchema>;

export type TContactUsParams = z.infer<typeof contactUsParamsSchema>;

export type { IContactUs } from "./contact-us.model.ts";

export { CONTACT_US_MESSAGES } from "./contact-us.constants.ts";
