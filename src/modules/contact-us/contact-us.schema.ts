import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export const createContactUsSchema = z.object({
  name: z.string().trim().min(2, "Please share your full name."),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => parsePhoneNumberFromString(value)?.isValid() === true,
      "Please enter a valid phone number.",
    ),
  email: z
    .email("Please enter a valid email address.")
    .or(z.literal(""))
    .optional(),
  concern: z.string().trim().min(1, "Please choose a primary concern."),
  message: z.string().trim().optional().default(""),
});

export const contactUsParamsSchema = z.object({
  id: z
    .string()
    .refine((value) => /^[a-f\d]{24}$/i.test(value), "Invalid contact id."),
});
