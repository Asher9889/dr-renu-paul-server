import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ApiResponse } from "../../utils/index.ts";
import { CONTACT_US_MESSAGES } from "./contact-us.constants.ts";
import type { ContactUsService } from "./contact-us.service.ts";
import type { TCreateContactUsPayload } from "./contact-us.types.ts";

export class ContactUsController {
  private readonly contactUsService: ContactUsService

  constructor(contactUsService: ContactUsService) {
    this.contactUsService = contactUsService;
  }

  createContactUs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = req.validatedBody as TCreateContactUsPayload;
      const contact = await this.contactUsService.createContactUs(payload);

      return ApiResponse.success(res, StatusCodes.CREATED, CONTACT_US_MESSAGES.CREATED, contact);
    } catch (error) {
      next(error);
    }
  };
}
