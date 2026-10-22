import { ContactUsController } from "./contact-us.controller.ts";
import { ContactUsService } from "./contact-us.service.ts";

const contactUsService = new ContactUsService();
const contactUsController = new ContactUsController(contactUsService);

export { contactUsController, contactUsService };
