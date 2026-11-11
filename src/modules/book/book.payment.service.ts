import crypto from "node:crypto";
import Razorpay from "razorpay";
import { envConfig } from "../../config/index.ts";
import { ApiError } from "../../utils/index.ts";
import { StatusCodes } from "http-status-codes";
import { BOOK_PURCHASE_MESSAGES } from "./book.constant.ts";

export type TRazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
};

export class BookPaymentService {
  private readonly client: Razorpay | null;

  constructor(keyId: string, keySecret: string) {
    // const { keyId, keySecret } = envConfig.razorpay;
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
 
  isConfigured(): boolean {
    return this.client !== null;
  }

  async createOrder(amountInPaise: number, currency: string, receipt: string): Promise<TRazorpayOrder> {
    if (!this.client) {
      throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, BOOK_PURCHASE_MESSAGES.PAYMENTS_NOT_CONFIGURED);
    }

    try { 
      const order = await this.client.orders.create({
        amount: amountInPaise,
        currency,
        receipt,
        payment_capture: true,
      });

      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        receipt: order.receipt ?? null,
        status: order.status,
      };
    } catch (error) {
      const description =
        (error as { error?: { description?: string }; message?: string })?.error?.description ||
        (error as { message?: string })?.message ||
        "Razorpay rejected the order request.";
      throw new ApiError(StatusCodes.BAD_GATEWAY, `Payment provider error: ${description}`);
    }
  }

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const { keySecret } = envConfig.razorpay;
    if (!keySecret) return false;

    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expected.length !== signature.length) return false;

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const { webhookSecret } = envConfig.razorpay;
    if (!webhookSecret) return false;

    const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

    if (expected.length !== signature.length) return false;

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}

export default BookPaymentService;