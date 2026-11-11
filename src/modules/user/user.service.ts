import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import { ApiError } from "../../utils/index.ts";
import { USER_MESSAGES, USER_ROLE, ACCOUNT_STATUS } from "./user.constant.ts";
import type { IUser, TUserRole, TAccountStatus } from "./user.types.ts";
import { UserModel, type IUserDocument } from "./user.model.ts";
import type {
    TCreateUserPayload,
    TUpdateUserPayload,
    TUserParams,
} from "./user.types.ts";

export class UserService {
    async createUser(payload: TCreateUserPayload): Promise<IUser> {
        const existingUser = await UserModel.findOne({ email: payload.email }).lean();

        if (existingUser) {
            throw new ApiError(
                StatusCodes.CONFLICT,
                USER_MESSAGES.EMAIL_ALREADY_EXISTS,
                [{ field: "email", message: USER_MESSAGES.EMAIL_ALREADY_EXISTS }],
            );
        }

        const user = await UserModel.create({
            email: payload.email,
            password: payload.password,
            role: (payload.role as TUserRole) || USER_ROLE.USER,
            accountStatus: (payload.accountStatus as TAccountStatus) || ACCOUNT_STATUS.ACTIVE,
        });
        return user;
    }

    async getUserById(id: string): Promise<IUser> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(
                StatusCodes.BAD_REQUEST,
                USER_MESSAGES.USER_NOT_FOUND,
            );
        }

        const user = await UserModel.findById(id).select("-password").lean();

        if (!user) {
            throw new ApiError(
                StatusCodes.NOT_FOUND,
                USER_MESSAGES.USER_NOT_FOUND,
            );
        }

        return user;
    }

    async getUserByEmail(email: string): Promise<IUser | null> {
        const user = await UserModel.findOne({ email }).select("+password").lean();

        if (!user) return null;

        // Lean documents expose `_id`; callers rely on the `id` virtual.
        return { ...user, id: String(user._id) };
    }

    /**
     * Resolves the account behind a verified Google profile. An existing
     * password account with the same email is linked to Google on first
     * sign-in instead of creating a duplicate.
     */
    async findOrCreateGoogleUser(profile: {
        googleId: string;
        email: string;
        name?: string | undefined;
        avatarUrl?: string | undefined;
    }): Promise<IUser> {
        const existingUser = await UserModel.findOne({
            $or: [{ googleId: profile.googleId }, { email: profile.email }],
        });

        if (existingUser) {
            if (existingUser.googleId && existingUser.googleId !== profile.googleId) {
                throw new ApiError(
                    StatusCodes.CONFLICT,
                    USER_MESSAGES.GOOGLE_ACCOUNT_CONFLICT,
                    [{ field: "email", message: USER_MESSAGES.GOOGLE_ACCOUNT_CONFLICT }],
                );
            }

            let hasChanges = false;

            if (!existingUser.googleId) {
                existingUser.googleId = profile.googleId;
                hasChanges = true;
            }

            // Google is the source of truth for the profile, so keep the
            // display name and avatar fresh on every sign-in.
            if (profile.name && existingUser.name !== profile.name) {
                existingUser.name = profile.name;
                hasChanges = true;
            }

            if (profile.avatarUrl && existingUser.avatarUrl !== profile.avatarUrl) {
                existingUser.avatarUrl = profile.avatarUrl;
                hasChanges = true;
            }

            if (hasChanges) {
                await existingUser.save();
            }

            return this.toUser(existingUser);
        }

        const createdUser = await UserModel.create({
            email: profile.email,
            googleId: profile.googleId,
            name: profile.name ?? null,
            avatarUrl: profile.avatarUrl ?? null,
            role: USER_ROLE.USER,
            accountStatus: ACCOUNT_STATUS.ACTIVE,
        });

        return this.toUser(createdUser);
    }

    private toUser(document: IUserDocument): IUser {
        return {
            id: document.id,
            email: document.email,
            name: document.name ?? null,
            avatarUrl: document.avatarUrl ?? null,
            role: document.role,
            accountStatus: document.accountStatus,
            lastLoginAt: document.lastLoginAt,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            googleId: document.googleId ?? null,
        };
    }

    async getUsers(
        page = 1,
        limit = 20,
        role?: TUserRole,
        accountStatus?: TAccountStatus,
    ): Promise<{ data: IUser[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
        const filter: Record<string, unknown> = {};

        if (role) filter.role = role;
        if (accountStatus) filter.accountStatus = accountStatus;

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            UserModel.find(filter)
                .select("-password")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            UserModel.countDocuments(filter),
        ]);

        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async updateUser(id: string, payload: TUpdateUserPayload): Promise<IUser> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(
                StatusCodes.BAD_REQUEST,
                USER_MESSAGES.USER_NOT_FOUND,
            );
        }

        if (payload.email) {
            const existingUser = await UserModel.findOne({
                email: payload.email,
                _id: { $ne: id },
            }).lean();

            if (existingUser) {
                throw new ApiError(
                    StatusCodes.CONFLICT,
                    USER_MESSAGES.EMAIL_ALREADY_EXISTS,
                    [{ field: "email", message: USER_MESSAGES.EMAIL_ALREADY_EXISTS }],
                );
            }
        }

        const user = await UserModel.findByIdAndUpdate(
            id,
            { $set: payload },
            { new: true, runValidators: true },
        ).select("-password").lean();

        if (!user) {
            throw new ApiError(
                StatusCodes.NOT_FOUND,
                USER_MESSAGES.USER_NOT_FOUND,
            );
        }

        return user;
    }

    async updateLastLogin(id: string): Promise<void> {
        await UserModel.findByIdAndUpdate(id, { lastLoginAt: new Date() });
    }

    async deleteUser(id: string): Promise<void> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(
                StatusCodes.BAD_REQUEST,
                USER_MESSAGES.USER_NOT_FOUND,
            );
        }

        const result = await UserModel.findByIdAndDelete(id);

        if (!result) {
            throw new ApiError(
                StatusCodes.NOT_FOUND,
                USER_MESSAGES.USER_NOT_FOUND,
            );
        }
    }

    async createSuperAdmin(email: string, password: string): Promise<IUser> {
        const existingAdmin = await UserModel.findOne({ role: USER_ROLE.SUPER_ADMIN }).lean();

        if (existingAdmin) {
            throw new ApiError(
                StatusCodes.CONFLICT,
                "Super admin already exists",
            );
        }

        const user = await UserModel.create({
            email,
            password,
            role: USER_ROLE.SUPER_ADMIN,
            accountStatus: ACCOUNT_STATUS.ACTIVE,
        });

        return user;
    }
}