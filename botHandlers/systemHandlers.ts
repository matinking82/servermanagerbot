import { Context, InlineKeyboard } from "grammy";
import { isAdmin } from "../core/adminCheck";
import logger from "../core/logger";
import { getSystemUsage } from "../services/systemServices";

export const systemMenuHandler = async (ctx: Context) => {
    if (!(await isAdmin(ctx))) return;

    try {
        const usage = await getSystemUsage();
        
        let message = "📊 <b>System Usage</b>\n\n";
        message += `🖥 <b>CPU:</b> ${usage.cpu}\n`;
        message += `🧠 <b>RAM:</b> ${usage.ram}\n`;
        message += `🔀 <b>Swap:</b> ${usage.swap}\n`;
        message += `💾 <b>Storage:</b> ${usage.storage}\n`;

        const kb = new InlineKeyboard().text("🔄 Refresh", "system_refresh");

        if (ctx.callbackQuery?.message) {
            await ctx.api.editMessageText(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id, message, {
                parse_mode: "HTML",
                reply_markup: kb,
            });
            await ctx.answerCallbackQuery();
        } else {
            await ctx.reply(message, { parse_mode: "HTML", reply_markup: kb });
        }
    } catch (error) {
        logger.error(error, { section: "systemMenuHandler" });
        await ctx.reply("❌ Error fetching system usage.");
    }
};

export const systemCallbackHandler = async (ctx: Context, action: string, params: string[]) => {
    if (!(await isAdmin(ctx))) return;

    try {
        if (action === "refresh") {
            await ctx.answerCallbackQuery({ text: "🔄 Refreshing..." });
            await systemMenuHandler(ctx);
        } else {
            await ctx.answerCallbackQuery({ text: "❌ Unknown action" });
        }
    } catch (error) {
        logger.error(error, { section: "systemCallbackHandler" });
        await ctx.answerCallbackQuery({ text: "❌ Error processing action" });
    }
};
