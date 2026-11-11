import mongoose from "mongoose";
import argon2 from "argon2";
import type { IUser } from "./user.types.ts";
import { USER_ROLE, ACCOUNT_STATUS } from "./user.constant.ts";

interface IUserDocument extends IUser, mongoose.Document {
    comparePassword(candidatePassword: string): Promise<boolean>;
    toSafeObject(): Omit<IUser, "password">;
}

const userSchema = new mongoose.Schema<IUserDocument>(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        // Google supplies these on every sign-in; they stay optional for
        // password-only accounts created by an administrator.
        name: {
            type: String,
            required: false,
            trim: true,
            maxlength: 120,
        },
        avatarUrl: {
            type: String,
            required: false,
            trim: true,
            maxlength: 2048,
        },
        password: {
            type: String,
            required: false,
            select: false,
        },
        googleId: {
            type: String,
            required: false,
        },
        role: {
            type: String,
            enum: Object.values(USER_ROLE),
            default: USER_ROLE.USER,
            required: true,
        },
        accountStatus: {
            type: String,
            enum: Object.values(ACCOUNT_STATUS),
            default: ACCOUNT_STATUS.ACTIVE,
            required: true,
        },
        lastLoginAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

userSchema.index({ email: 1 }, { unique: true });
// Sparse so existing and passwordless accounts without a Google link do not collide.
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ accountStatus: 1 });

userSchema.pre("save", async function (this: IUserDocument) {
    if (!this.isModified("password") || !this.password) return;

    try {
        this.password = await argon2.hash(this.password, {
            type: argon2.argon2id,
            memoryCost: 2 ** 16,
            timeCost: 3,
            parallelism: 1,
        });
        // next();
    } catch (error) {
        throw error;
        // next(error as Error);
    }
});

userSchema.methods.comparePassword = async function (this: IUserDocument, candidatePassword: string): Promise<boolean> {
    if (!this.password) return false;

    try {
        return await argon2.verify(this.password, candidatePassword);
    } catch {
        return false;
    }
};

userSchema.methods.toSafeObject = function (this: IUserDocument): Omit<IUser, "password"> {
    const obj = this.toObject({ virtuals: true });
    const { password, ...safeObj } = obj;
    return safeObj;
};

export const UserModel = mongoose.model<IUserDocument>("User", userSchema);

export type { IUser, IUserDocument };
export { USER_ROLE, ACCOUNT_STATUS };