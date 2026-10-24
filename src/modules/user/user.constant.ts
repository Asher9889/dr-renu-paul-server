export const USER_ROLE = {
    SUPER_ADMIN: "super_admin",
    ADMIN: "admin",
    USER: "user",
} as const;

export const ACCOUNT_STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    BLOCKED: "blocked",
    PENDING_VERIFICATION: "pending_verification",
} as const;

export const USER_MESSAGES = {
    USER_CREATED: "User created successfully.",
    USER_FETCHED: "User fetched successfully.",
    USER_UPDATED: "User updated successfully.",
    USER_DELETED: "User deleted successfully.",
    USERS_FETCHED: "Users fetched successfully.",
    INVALID_CREDENTIALS: "Invalid email or password.",
    ACCOUNT_INACTIVE: "Account is inactive. Please contact administrator.",
    ACCOUNT_BLOCKED: "Account has been blocked. Please contact administrator.",
    EMAIL_ALREADY_EXISTS: "Email already exists.",
    USER_NOT_FOUND: "User not found.",
} as const;