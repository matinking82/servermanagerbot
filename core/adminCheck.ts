import { Context } from "grammy";
import { getUserById } from "../services/userDbServices";
import logger from "./logger";

/**
 * Check if the user is an admin. If not, send a rejection message.
 * Returns true if admin, false otherwise.
 */
export const isAdmin = async (ctx: Context): Promise<boolean> => {
    try {
        let userId = ctx.from?.id;
        if (!userId) {
            await ctx.reply("❌ Could not identify user.");
            return false;
        }

        let user = await getUserById(userId);

        if (!user || !user.isAdmin) {
            await ctx.reply("🔒 Access denied. Admin privileges required.\n\nUse /login <username> <password> to authenticate.");
            return false;
        }

        return true;
    } catch (error) {
        logger.error(error, { section: "isAdmin" });
        await ctx.reply("❌ Error checking permissions.");
        return false;
    }
};
