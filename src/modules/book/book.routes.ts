import express from "express";
import authenticate from "../../middlewares/authenticate.ts";
import optionalAuthenticate from "../../middlewares/optionalAuthenticate.ts";
import paramsValidate from "../../middlewares/paramsValidate.ts";
import queryValidate from "../../middlewares/queryValidate.ts";
import schemaValidate from "../../middlewares/schemaValidate.ts";
import { bookFileUpload, imageUpload } from "../../middlewares/upload.ts";
import { bookController } from "./book.module.ts";
import {
  adminBookListQuerySchema,
  adminBookParamsSchema,
  createBookSchema,
  publicBookListQuerySchema,
  publicBookParamsSchema,
  publishBookSchema,
  readerPageParamsSchema,
  updateBookSchema,
  verifyPurchaseSchema,
} from "./book.schema.ts";

const bookRoutes = express.Router();

bookRoutes.get("/media/*key", bookController.serveMedia);
bookRoutes.get("/purchases", authenticate, bookController.listPurchases);
bookRoutes.get("/", queryValidate(publicBookListQuerySchema), bookController.getPublicBooks);
bookRoutes.get("/:slug", paramsValidate(publicBookParamsSchema), bookController.getPublicBook);
bookRoutes.get("/:slug/access", optionalAuthenticate, paramsValidate(publicBookParamsSchema), bookController.getBookAccess);
bookRoutes.get("/:slug/reader", optionalAuthenticate, paramsValidate(publicBookParamsSchema), bookController.getBookReader);
bookRoutes.get("/:slug/pages/:pageNumber", optionalAuthenticate, paramsValidate(readerPageParamsSchema), bookController.serveReaderPage);
bookRoutes.post("/:slug/purchase", optionalAuthenticate, paramsValidate(publicBookParamsSchema), bookController.purchaseBook);
bookRoutes.post("/:slug/purchase/order", authenticate, paramsValidate(publicBookParamsSchema), bookController.createPurchaseOrder);
bookRoutes.post("/:slug/purchase/verify", authenticate, paramsValidate(publicBookParamsSchema), schemaValidate(verifyPurchaseSchema), bookController.verifyPurchase);

const bookAdminRoutes = express.Router();

bookAdminRoutes.get("/", queryValidate(adminBookListQuerySchema), bookController.getAdminBooks);
bookAdminRoutes.post("/", schemaValidate(createBookSchema), bookController.createAdminBook);
bookAdminRoutes.get("/:id", paramsValidate(adminBookParamsSchema), bookController.getAdminBook);
bookAdminRoutes.patch("/:id", paramsValidate(adminBookParamsSchema), schemaValidate(updateBookSchema), bookController.updateAdminBook);
bookAdminRoutes.post("/:id/reprocess", paramsValidate(adminBookParamsSchema), bookController.reprocessAdminBook);
bookAdminRoutes.post("/:id/publish", paramsValidate(adminBookParamsSchema), schemaValidate(publishBookSchema), bookController.publishAdminBook);
bookAdminRoutes.post("/:id/unpublish", paramsValidate(adminBookParamsSchema), bookController.unpublishAdminBook);
bookAdminRoutes.post("/:id/archive", paramsValidate(adminBookParamsSchema), bookController.archiveAdminBook);
bookAdminRoutes.delete("/:id", paramsValidate(adminBookParamsSchema), bookController.deleteAdminBook);
bookAdminRoutes.post("/media/cover", imageUpload.single("file"), bookController.uploadCover);
bookAdminRoutes.post("/media/ebook", bookFileUpload.single("file"), bookController.uploadEbook);

export { bookAdminRoutes, bookRoutes };
