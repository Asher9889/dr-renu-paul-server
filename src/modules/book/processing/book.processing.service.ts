import mongoose from "mongoose";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFPageProxy } from "pdfjs-dist";
import { envConfig, logger } from "../../../config/index.ts";
import {
  BOOK_PAGE_LIMITS,
  BOOK_PROCESSING_STATUS,
  BOOK_PROCESSING_MESSAGES,
} from "../book.constant.ts";
import BookModel from "../book.model.ts";
import BookPageModel from "../book-page.model.ts";
import BookProcessingJobModel, {
  type IBookProcessingJob,
} from "./book-processing-job.model.ts";
import type { BookMediaService } from "../book.media.service.ts";

const STALE_JOB_MS = 10 * 60 * 1000;

class NonRetryableProcessingError extends Error {}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 1500);
  }
  return "The ebook could not be prepared for the reader.";
}

export class BookProcessingService {
  private readonly mediaService: BookMediaService;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(mediaService: BookMediaService) {
    this.mediaService = mediaService;
  }

  start = (): void => {
    if (!envConfig.book.worker.enabled) {
      logger.info("Book processing worker is disabled.");
      return;
    }
    if (this.timer) return;

    this.timer = setInterval(() => {
      void this.tick();
    }, BOOK_PAGE_LIMITS.WORKER_POLL_INTERVAL_MS);

    void this.tick();
    logger.info("Book processing worker started.");
  };

  stop = (): void => {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  };

  /**
   * Queues (or re-queues) a book for page rendering. A job that is already
   * running is left alone; its storage-key guard makes it retry with the newer
   * file once it finishes.
   */
  enqueue = async (bookId: string, options: { reset?: boolean } = {}): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(bookId)) return;

    const objectId = new mongoose.Types.ObjectId(bookId);
    const now = new Date();

    await BookProcessingJobModel.updateOne(
      { bookId: objectId },
      [
        {
          $set: {
            status: {
              $cond: [
                { $eq: ["$status", "PROCESSING"] },
                "$status",
                "PENDING",
              ],
            },
            attempts: {
              $cond: [
                { $eq: ["$status", "PROCESSING"] },
                "$attempts",
                0,
              ],
            },
            maxAttempts: BOOK_PAGE_LIMITS.WORKER_MAX_ATTEMPTS,
            runAt: {
              $cond: [{ $eq: ["$status", "PROCESSING"] }, "$runAt", now],
            },
            lockedAt: {
              $cond: [{ $eq: ["$status", "PROCESSING"] }, "$lockedAt", null],
            },
            lastError: {
              $cond: [{ $eq: ["$status", "PROCESSING"] }, "$lastError", null],
            },
          },
        },
      ],
      { upsert: true, updatePipeline: true },
    );

    const keepCurrentProgress = !options.reset;

    await BookModel.updateOne(
      { _id: objectId },
      [
        {
          $set: {
            "processing.status": {
              $cond: [
                { $eq: ["$processing.status", BOOK_PROCESSING_STATUS.PROCESSING] },
                "$processing.status",
                BOOK_PROCESSING_STATUS.PENDING,
              ],
            },
            "processing.pageCount": {
              $cond: [
                { $eq: ["$processing.status", BOOK_PROCESSING_STATUS.PROCESSING] },
                "$processing.pageCount",
                keepCurrentProgress ? "$processing.pageCount" : 0,
              ],
            },
            "processing.error": {
              $cond: [
                { $eq: ["$processing.status", BOOK_PROCESSING_STATUS.PROCESSING] },
                "$processing.error",
                null,
              ],
            },
            "processing.startedAt": {
              $cond: [
                { $eq: ["$processing.status", BOOK_PROCESSING_STATUS.PROCESSING] },
                "$processing.startedAt",
                null,
              ],
            },
            "processing.completedAt": {
              $cond: [
                { $eq: ["$processing.status", BOOK_PROCESSING_STATUS.PROCESSING] },
                "$processing.completedAt",
                null,
              ],
            },
          },
        },
      ],
      { updatePipeline: true },
    );
  };

  private claimNextJob = async (): Promise<IBookProcessingJob | null> => {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_JOB_MS);

    return BookProcessingJobModel.findOneAndUpdate(
      {
        $or: [
          { status: "PENDING", runAt: { $lte: now } },
          { status: "PROCESSING", lockedAt: { $lte: staleBefore } },
        ],
      },
      {
        $set: { status: "PROCESSING", lockedAt: now },
        $inc: { attempts: 1 },
      },
      { sort: { runAt: 1, createdAt: 1 }, new: true },
    );
  };

  private tick = async (): Promise<void> => {
    if (this.running) return;
    this.running = true;

    try {
      for (;;) {
        const job = await this.claimNextJob();
        if (!job) break;
        await this.processJob(job);
      }
    } catch (error) {
      logger.error({ err: error }, "Book processing worker tick failed");
    } finally {
      this.running = false;
    }
  };

  private renderPage = async (bookId: string, pdfPage: PDFPageProxy, pageNumber: number ) => {
    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const scale = Math.max(
      0.2,
      Math.min(
        BOOK_PAGE_LIMITS.RENDER_TARGET_WIDTH / baseViewport.width,
        BOOK_PAGE_LIMITS.RENDER_MAX_HEIGHT / baseViewport.height,
        4,
      ),
    );
    const viewport = pdfPage.getViewport({ scale });
    const width = Math.max(1, Math.round(viewport.width));
    const height = Math.max(1, Math.round(viewport.height));

    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    try {
      await pdfPage.render({
        canvasContext: context as never,
        canvas: canvas as never,
        viewport,
      }).promise;

      const png = await canvas.encode("png");
      return this.mediaService.uploadPageImage(
        bookId,
        pageNumber,
        Buffer.from(png),
        width,
        height,
      );
    } finally {
      pdfPage.cleanup();
    }
  };

  private processJob = async (job: IBookProcessingJob): Promise<void> => {
    const book = await BookModel.findById(job.bookId);

    if (!book) {
      await BookProcessingJobModel.updateOne(
        { _id: job._id },
        { $set: { status: "COMPLETED", lockedAt: null, lastError: null } },
      );
      return;
    }

    if (!book.ebook) {
      await this.failJob(job, null, new NonRetryableProcessingError(
        "This edition has no ebook file to prepare.",
      ));
      return;
    }

    const sourceKey = book.ebook.storageKey;
    const startedAt = job.lockedAt ?? new Date();

    try {
      if (book.ebook.mimeType !== "application/pdf") {
        throw new NonRetryableProcessingError(
          "Only PDF editions can be prepared for the flipper reader.",
        );
      }

      await BookModel.updateOne(
        { _id: book._id },
        {
          $set: {
            "processing.status": BOOK_PROCESSING_STATUS.PROCESSING,
            "processing.error": null,
            "processing.startedAt": startedAt,
            "processing.completedAt": null,
          },
        },
      );

      const buffer = await this.mediaService.getEbookBuffer(sourceKey);
      const loadingTask = getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        disableFontFace: true,
      });

      try {
        const pdf = await loadingTask.promise;

        if (pdf.numPages < 1) {
          throw new NonRetryableProcessingError("The PDF has no pages to render.");
        }

        if (pdf.numPages > BOOK_PAGE_LIMITS.MAX_RENDERED_PAGES) {
          throw new NonRetryableProcessingError(
            `The PDF has ${pdf.numPages} pages; the reader supports up to ${BOOK_PAGE_LIMITS.MAX_RENDERED_PAGES}.`,
          );
        }

        const renderedPages = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const pdfPage = await pdf.getPage(pageNumber);
          const rendered = await this.renderPage(
            String(book._id),
            pdfPage,
            pageNumber,
          );
          renderedPages.push({ pageNumber, ...rendered });
        }

        if (renderedPages.length > 0) {
          await BookPageModel.bulkWrite(
            renderedPages.map((page) => ({
              updateOne: {
                filter: { bookId: book._id, pageNumber: page.pageNumber },
                update: {
                  $set: {
                    storageKey: page.storageKey,
                    width: page.width,
                    height: page.height,
                    mimeType: page.mimeType,
                    sizeBytes: page.sizeBytes,
                  },
                },
                upsert: true,
              },
            })),
            { ordered: false },
          );
        }

        const stalePages = await BookPageModel.find({
          bookId: book._id,
          pageNumber: { $gt: pdf.numPages },
        })
          .select("storageKey")
          .lean();

        await BookPageModel.deleteMany({
          bookId: book._id,
          pageNumber: { $gt: pdf.numPages },
        });

        if (stalePages.length > 0) {
          void this.mediaService.removeObjects(
            stalePages.map((page) => page.storageKey),
          );
        }

        const updateResult = await BookModel.updateOne(
          { _id: book._id, "ebook.storageKey": sourceKey },
          {
            $set: {
              totalPages: pdf.numPages,
              "processing.status": BOOK_PROCESSING_STATUS.READY,
              "processing.pageCount": pdf.numPages,
              "processing.error": null,
              "processing.startedAt": startedAt,
              "processing.completedAt": new Date(),
            },
          },
        );

        if (updateResult.matchedCount === 0) {
          throw new Error(
            "The ebook changed while it was being prepared. Preparing the newer file.",
          );
        }

        await BookProcessingJobModel.updateOne(
          { _id: job._id },
          { $set: { status: "COMPLETED", lockedAt: null, lastError: null } },
        );

        logger.info(
          { bookId: String(book._id), pages: pdf.numPages },
          "Book pages prepared for the reader.",
        );
      } finally {
        await loadingTask.destroy();
      }
    } catch (error) {
      await this.failJob(job, sourceKey, error);
    }
  };

  private failJob = async (
    job: IBookProcessingJob,
    sourceKey: string | null,
    error: unknown,
  ): Promise<void> => {
    const message = toErrorMessage(error);
    const currentBook = await BookModel.findById(job.bookId)
      .select("ebook.storageKey")
      .lean();

    const sourceChanged =
      Boolean(currentBook?.ebook?.storageKey) &&
      Boolean(sourceKey) &&
      currentBook?.ebook?.storageKey !== sourceKey;

    if (!currentBook) {
      await BookProcessingJobModel.updateOne(
        { _id: job._id },
        { $set: { status: "COMPLETED", lockedAt: null, lastError: message } },
      );
      return;
    }

    if (!currentBook.ebook) {
      await BookProcessingJobModel.updateOne(
        { _id: job._id },
        { $set: { status: "COMPLETED", lockedAt: null, lastError: message } },
      );
      return;
    }

    if (sourceChanged) {
      await BookProcessingJobModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "PENDING",
            attempts: 0,
            runAt: new Date(),
            lockedAt: null,
            lastError: message,
          },
        },
      );
      return;
    }

    const retryable =
      !(error instanceof NonRetryableProcessingError) &&
      job.attempts < job.maxAttempts;
    const status = retryable ? "PENDING" : "FAILED";

    await BookProcessingJobModel.updateOne(
      { _id: job._id },
      {
        $set: {
          status,
          lockedAt: null,
          lastError: message,
          runAt: retryable
            ? new Date(Date.now() + BOOK_PAGE_LIMITS.WORKER_RETRY_DELAY_MS)
            : job.runAt,
        },
      },
    );

    await BookModel.updateOne(
      { _id: job.bookId },
      {
        $set: {
          "processing.status": retryable
            ? BOOK_PROCESSING_STATUS.PENDING
            : BOOK_PROCESSING_STATUS.FAILED,
          "processing.error": message,
          "processing.completedAt": null,
        },
      },
    );

    logger.error(
      { bookId: String(job.bookId), attempts: job.attempts, retryable, err: error },
      BOOK_PROCESSING_MESSAGES.READY_REQUIRED,
    );
  };
}
