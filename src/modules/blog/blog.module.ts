import { BlogController } from "./blog.controller.ts";
import { BlogMediaService } from "./blog.media.service.ts";
import { BlogService } from "./blog.service.ts";

const blogService = new BlogService();
const blogMediaService = new BlogMediaService();
const blogController = new BlogController(blogService, blogMediaService);

export { blogController, blogMediaService, blogService };
