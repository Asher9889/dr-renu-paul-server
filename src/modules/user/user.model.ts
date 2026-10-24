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
        password: {
            type: String,
            required: true,
            select: false,
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
userSchema.index({ role: 1 });
userSchema.index({ accountStatus: 1 });

(userSchema as any).pre("save", async function (this: IUserDocument, next: (err?: Error) => void) {
    if (!this.isModified("password")) return next();

    try {
        this.password = await argon2.hash(this.password, {
            type: argon2.argon2id,
            memoryCost: 2 ** 16,
            timeCost: 3,
            parallelism: 1,
        });
        next();
    } catch (error) {
        next(error as Error);
    }
});

userSchema.methods.comparePassword = async function (this: IUserDocument, candidatePassword: string): Promise<boolean> {
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