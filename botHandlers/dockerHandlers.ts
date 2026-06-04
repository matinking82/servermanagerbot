import { Context, InlineKeyboard } from "grammy";
import { isAdmin } from "../core/adminCheck";
import logger from "../core/logger";
import { dockerList, dockerStop, dockerRestart } from "../services/dockerServices";

/**
 * Shows list of running Docker containers with Stop/Restart buttons
 */
export const dockerMenuHandler = async (ctx: Context) => {
    if (!(await isAdmin(ctx))) return;

    try {
        const result = await dockerList();

        if (!result.success) {
            await ctx.reply(`❌ ${result.message}`);
            return;
        }

        if (result.containers.length === 0) {
            const kb = new InlineKeyboard();
            kb.text("🔄 Refresh", "docker_refresh");
            await ctx.reply("🐳 No running Docker containers found.", { reply_markup: kb });
            return;
        }

        let message = "🐳 <b>Docker Containers</b>\n\n";

        const kb = new InlineKeyboard();

        for (const container of result.containers) {
            message += `📦 <b>${container.name}</b>\n`;
            message += `   Image: <code>${container.image}</code>\n`;
            message += `   Status: ${container.status}\n`;
            message += `   Ports: ${container.ports || "none"}\n\n`;

            kb.text("⏹ Stop", `docker_stop_${container.name}`)
              .text("🔄 Restart", `docker_restart_${container.name}`)
              .row();
        }

        kb.text("🔄 Refresh", "docker_refresh").row();

        await ctx.reply(message, { parse_mode: "HTML", reply_markup: kb });
    } catch (error) {
        logger.error(error, { section: "dockerMenuHandler" });
        await ctx.reply("❌ Error loading Docker menu.");
    }
};

/**
 * Handles Docker callback actions: stop, restart, refresh
 */
export const dockerCallbackHandler = async (ctx: Context, action: string, params: string[]) => {
    if (!(await isAdmin(ctx))) return;

    try {
        switch (action) {
            case "stop": {
                const name = params.join("_");
                const result = await dockerStop(name);
                await ctx.answerCallbackQuery({ text: result.message });
                if (result.success) {
                    await dockerMenuHandler(ctx);
                }
                break;
            }

            case "restart": {
                const name = params.join("_");
                const result = await dockerRestart(name);
                await ctx.answerCallbackQuery({ text: result.message });
                if (result.success) {
                    await dockerMenuHandler(ctx);
                }
                break;
            }

            case "refresh": {
                await ctx.answerCallbackQuery({ text: "🔄 Refreshing..." });
                await dockerMenuHandler(ctx);
                break;
            }

            default: {
                await ctx.answerCallbackQuery({ text: "❌ Unknown action" });
                break;
            }
        }
    } catch (error) {
        logger.error(error, { section: "dockerCallbackHandler" });
        await ctx.answerCallbackQuery({ text: "❌ Error processing action" });
    }
};
