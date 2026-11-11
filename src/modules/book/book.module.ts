import { BookController } from "./book.controller.ts";
import { BookMediaService } from "./book.media.service.ts";
import { BookProcessingService } from "./processing/book.processing.service.ts";
import { BookReaderService } from "./book.reader.service.ts";
import { BookService } from "./book.service.ts";
import { BookPaymentService } from "./book.payment.service.ts";
import { envConfig } from "../../config/index.ts";

const { keyId, keySecret } = envConfig.razorpay;

const bookMediaService = new BookMediaService();
const bookProcessingService = new BookProcessingService(bookMediaService);
const bookReaderService = new BookReaderService(bookMediaService);
const bookPaymentService = new BookPaymentService(keyId, keySecret);
const bookService = new BookService(bookProcessingService, bookMediaService);
const bookController = new BookController(bookService, bookMediaService, bookReaderService);

export {
  bookController,
  bookMediaService,
  bookProcessingService,
  bookReaderService,
  bookService,
  bookPaymentService
};
