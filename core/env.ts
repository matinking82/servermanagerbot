import fs from "fs";
import path from "path";
import dotenv from "dotenv";

/**
 * Returns a copy of process.env with the application-specific variables (from .env) removed.
 * This is useful when spawning child processes (like a bash session) so they don't
 * inherit the main application's environment variables (e.g. BOT_TOKEN), allowing them
 * to load their own .env files properly.
 */
export const getCleanEnv = (): NodeJS.ProcessEnv => {
    const cleanEnv = { ...process.env };
    try {
        const envPath = path.resolve(process.cwd(), ".env");
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath);
            const parsed = dotenv.parse(envContent);
            for (const key of Object.keys(parsed)) {
                delete cleanEnv[key];
            }
        }
    } catch (e) {
        // Ignore error
    }
    return cleanEnv;
};
