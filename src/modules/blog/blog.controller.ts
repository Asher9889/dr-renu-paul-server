import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ApiError, ApiResponse } from "../../utils/index.ts";
import { BLOG_MESSAGES } from "./blog.constant.ts";
import type { BlogMediaService } from "./blog.media.service.ts";
import type { BlogService } from "./blog.service.ts";
import type {
  TAdminBlogPostListQuery,
  TAdminBlogPostParams,
  TCreateBlogPostPayload,
  TPublishBlogPostPayload,
  TPublicBlogFeaturedQuery,
  TPublicBlogPostListQuery,
  TPublicBlogPostParams,
  TUpdateBlogPostPayload,
} from "./blog.types.ts";

interface TMediaProxyParams {
  folder: string;
  year: string;
  month: string;
  filename: string;
}

export class BlogController {
  private readonly blogService: BlogService;
  private readonly mediaService: BlogMediaService;

  constructor(blogService: BlogService, mediaService: BlogMediaService) {
    this.blogService = blogService;
    this.mediaService = mediaService;
  }

  getPublicPosts = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const query = req.validatedQuery as TPublicBlogPostListQuery;
      const result = await this.blogService.getPublicPosts(query);

      return ApiResponse.success(
        res,
        StatusCodes.OK,
        BLOG_MESSAGES.POSTS_FETCHED,
        result.data,
        result.meta,
      );
    } catch (error) {
      next(error);
    }
  };

  getPublicFeaturedPosts = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const query = req.validatedQuery as TPublicBlogFeaturedQuery;
      const result = await this.blogService.getPublicFeaturedPosts(query);

      return ApiResponse.success(
        res,
        StatusCodes.OK,
        BLOG_MESSAGES.FEATURED_POSTS_FETCHED,
        result.data,
      );
    } catch (error) {
      next(error);
    }
  };

  getPublicPost = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { slug } = req.validatedParams as TPublicBlogPostParams;
      const post = await this.blogService.getPublicPost(slug);

      return ApiResponse.success(
        res,
        StatusCodes.OK,
        BLOG_MESSAGES.POST_FETCHED,
        post,
      );
    } catch (error) {
      next(error);
    }
  };

  getPublicTags = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.blogService.getPublicTags();

      return ApiResponse.success(
        res,
        StatusCodes.OK,
        BLOG_MESSAGES.TAGS_FETCHED,
        result.data,
        result.meta,
      );
    } catch (error) {
      next(error);
    }
  };

  getPublicAuthor = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.blogService.getPublicAuthor();

      return ApiResponse.success(
        res,
        StatusCodes.OK,
        BLOG_MESSAGES.AUTHOR_FETCHED,
        result.data,
      );
    } catch (error) {
      next(error);
    }
  };

  serveMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { folder, year, month, filename } =
        req.params as unknown as TMediaProxyParams;
      const media = await this.mediaService.getMediaObject(
        folder,
        year,
        month,
        filename,
      );

      res.setHeader("Content-Type", media.contentType);
      res.setHeader("Cache-Control", media.cacheControl);
      res.setHeader("Content-Length", String(media.body.byteLength));

      return res.status(StatusCodes.OK).send(Buffer.from(media.body));
    } catch (error) {
      next(error);
    }
  };

  getAdminPosts = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const query = req.validatedQuery as TAdminBlogPostListQuery;
      const result = await this.blogService.getAdminPosts(query);

      return ApiResponse.success(
        res,
        StatusCodes.OK,
        BLOG_MESSAGES.POSTS_FETCHED,
        result.data,
        result.meta,
      );
    } catch (error) {
      next(error);
    }
  };

  getAdminPost = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.validatedParams as TAdminBlogPostParams;
      const post = await this.blogService.getAdminPost(id);

      return ApiResponse.success(
        res,
        StatusCodes.OK,
        BLOG_MESSAGES.POST_FETCHED,
        post,
      );
    } catch (error) {
      next(error);
    }
  };

  createAdminPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = req.validatedBody as TCreateBlogPostPayload;
      const post = await this.blogService.createPost(payload);

      return ApiResponse.success(
        res,
        StatusCodes.CREATED,
        BLOG_MESSAGES.POST_CREATED,
        post,
      );
    } catch (error) {
      next(error);
    }
  };

  updateAdminPost = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.validatedParams as TAdminBlogPostParams;
      const payload = req.validatedBody as TUpdateBlogPostPayload;
      const post = await this.blogService.updatePost(id, payload);

      return ApiResponse.success(
        res,
        StatusCodes.OK,
        BLOG_MESSAGES.POST_UPDATED,
        post,
      );
    } catch (error) {
      next(error);
    }
  };

  publishAdminPost = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.validatedParams as TAdminBlogPostParams;
      const payload = req.validatedBody as TPublishBlogPostPayload;
      const post = await this.blogService.publishPost(id, payload);

      return ApiResponse.success(
        res,
        StatusCodes.OK,
        BLOG_MESSAGES.POST_PUBLISHED,
        post,
      );
    } catch (error) {
      next(error);
    }
  };

  unpublishAdminPost = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.validatedParams as TAdminBlogPostParams;
      const post = await this.blogService.unpublishPost(id);

      return ApiResponse.success(
        res,
        StatusCodes.OK,
        BLOG_MESSAGES.POST_UNPUBLISHED,
        post,
      );
    } catch (error) {
      next(error);
    }
  };

  archiveAdminPost = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.validatedParams as TAdminBlogPostParams;
      const post = await this.blogService.archivePost(id);

      return ApiResponse.success(
        res,
        StatusCodes.OK,
        BLOG_MESSAGES.POST_ARCHIVED,
        post,
      );
    } catch (error) {
      next(error);
    }
  };

  deleteAdminPost = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.validatedParams as TAdminBlogPostParams;
      await this.blogService.deletePost(id);

      return ApiResponse.noContent(res);
    } catch (error) {
      next(error);
    }
  };

  uploadAdminMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "Image is required.", [
          { field: "file", message: "Please choose an image to upload." },
        ]);
      }

      // const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
      // const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
      // const host = forwardedHost || req.get("host");
      // const requestBaseUrl = host ? `${forwardedProto || req.protocol}://${host}` : "";

      const media = await this.mediaService.uploadImage(req.file);

      return ApiResponse.success(res, StatusCodes.CREATED, BLOG_MESSAGES.MEDIA_UPLOADED, media);
    } catch (error) {
      next(error);
    }
  };
}
