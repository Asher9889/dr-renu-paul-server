import { envConfig } from "../config/index.ts";
import { connectMongoDB } from "../db/index.ts";
import { userService } from "../modules/user/user.module.ts";
import { logger } from "../config/index.ts";

async function seedSuperAdmin() {
    try {
        await connectMongoDB();

        const { email, password } = envConfig.superAdmin;

        if (!email || !password) {
            logger.error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in environment variables");
            process.exit(1);
        }

        const existingAdmin = await userService.getUserByEmail(email);

        if (existingAdmin) {
            logger.info({ email }, "Super admin already exists");
            process.exit(0);
        }

        await userService.createSuperAdmin(email, password);
        logger.info({ email }, "Super admin created successfully");
        process.exit(0);
    } catch (error) {
        logger.error({ err: error }, "Failed to seed super admin");
        process.exit(1);
    }
}

seedSuperAdmin();