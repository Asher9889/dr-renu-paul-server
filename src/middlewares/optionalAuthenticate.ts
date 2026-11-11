import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { envConfig, logger } from "../config/index.ts";
import { ACCOUNT_STATUS } from "../modules/user/user.constant.ts";
import { UserModel } from "../modules/user/user.model.ts";
import type { TAccessTokenPayload } from "../modules/auth/auth.types.ts";

/**
 * Attaches the signed-in reader to the request when a valid access token is
 * present, but never blocks anonymous visitors. Used by the public reader and
 * purchase endpoints so previews keep working without an account.
 */
async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const accessToken = req.cookies?.accessToken;

  if (!accessToken) {
    return next();
  }

  try {
    const decoded = jwt.verify(accessToken, envConfig.jwtConfig.accessTokenSecret) as TAccessTokenPayload;

    if (!decoded?.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
      return next();
    }

    const user = await UserModel.findById(decoded.id).select("-password").lean();

    if (!user || user.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
      return next();
    }

    // Lean documents expose `_id`; the rest of the app expects `id`.
    req.validatedUser = { ...user, id: String(user._id) };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
      return next();
    }
    logger.warn({ err: error }, "Optional authentication failed; continuing anonymously");
  }

  return next();
}

export default optionalAuthenticate;
