import express from "express";
import paramsValidate from "../../middlewares/paramsValidate.ts";
import queryValidate from "../../middlewares/queryValidate.ts";
import schemaValidate from "../../middlewares/schemaValidate.ts";
import upload from "../../middlewares/upload.ts";
import { blogController } from "./blog.module.ts";
import {
  adminBlogPostListQuerySchema,
  adminBlogPostParamsSchema,
  createBlogPostSchema,
  publicBlogPostListQuerySchema,
  publicBlogPostParamsSchema,
  publishBlogPostSchema,
  updateBlogPostSchema,
} from "./blog.schema.ts";

const blogRoutes = express.Router();

blogRoutes.get("/posts", queryValidate(publicBlogPostListQuerySchema), blogController.getPublicPosts);
blogRoutes.get("/posts/:slug", paramsValidate(publicBlogPostParamsSchema), blogController.getPublicPost);
blogRoutes.get("/tags", blogController.getPublicTags);
blogRoutes.get("/author", blogController.getPublicAuthor);
blogRoutes.get("/media/:folder/:year/:month/:filename", blogController.serveMedia);

const blogAdminRoutes = express.Router();

blogAdminRoutes.get("/posts", queryValidate(adminBlogPostListQuerySchema), blogController.getAdminPosts);
blogAdminRoutes.post("/posts", schemaValidate(createBlogPostSchema), blogController.createAdminPost);
blogAdminRoutes.get("/posts/:id", paramsValidate(adminBlogPostParamsSchema), blogController.getAdminPost);
blogAdminRoutes.patch("/posts/:id", paramsValidate(adminBlogPostParamsSchema), schemaValidate(updateBlogPostSchema), blogController.updateAdminPost);
blogAdminRoutes.post("/posts/:id/publish", paramsValidate(adminBlogPostParamsSchema), schemaValidate(publishBlogPostSchema), blogController.publishAdminPost);
blogAdminRoutes.post("/posts/:id/unpublish", paramsValidate(adminBlogPostParamsSchema), blogController.unpublishAdminPost);
blogAdminRoutes.post("/posts/:id/archive", paramsValidate(adminBlogPostParamsSchema), blogController.archiveAdminPost);
blogAdminRoutes.delete("/posts/:id", paramsValidate(adminBlogPostParamsSchema), blogController.deleteAdminPost);
blogAdminRoutes.post("/media", upload.single("file"), blogController.uploadAdminMedia);

export { blogAdminRoutes, blogRoutes };
