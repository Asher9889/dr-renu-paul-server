import { ContactUsModel } from "./contact-us.model.ts";
import type { TCreateContactUsPayload } from "./contact-us.types.ts";

export class ContactUsService {
  createContactUs = async (payload: TCreateContactUsPayload) => {
    const contact = await ContactUsModel.create({
      ...payload,
      email: payload.email ?? "",
    });

    return {
      id: contact._id.toString(),
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      concern: contact.concern,
      message: contact.message,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  };
}
