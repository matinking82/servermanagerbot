import { Context, InlineKeyboard } from "grammy";
import { isAdmin } from "../core/adminCheck";
import logger from "../core/logger";
import { dockerList, dockerStop, dockerRestart } from "../services/dockerServices";

const PAGE_SIZE = 5;

const buildDockerMessage = async (page: number = 0): Promise<{ text: string; keyboard: InlineKeyboard }> => {
    const result = await dockerList();

    if (!result.success) {
        return {
            text: `❌ ${result.message}`,
            keyboard: new InlineKeyboard().text("🔄 Refresh", "docker_refresh"),
        };
    }

    const containers = result.containers;

    if (containers.length === 0) {
        return {
            text: "🐳 No running Docker containers found.",
            keyboard: new InlineKeyboard().text("🔄 Refresh", "docker_refresh"),
        };
    }

    const totalContainers = containers.length;
    const totalPages = Math.ceil(totalContainers / PAGE_SIZE);

    if (page >= totalPages && totalPages > 0) page = totalPages - 1;
    if (page < 0) page = 0;

    let text = `🐳 <b>Docker Containers</b> (Page ${page + 1}/${totalPages})\n\n`;

    const keyboard = new InlineKeyboard();

    const currentContainers = containers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    for (const container of currentContainers) {
        text += `📦 <b>${container.name}</b>\n`;
        text += `   Image: <code>${container.image}</code>\n`;
        text += `   Status: ${container.status}\n`;
        text += `   Ports: ${container.ports || "none"}\n\n`;

        keyboard.text("⏹ Stop", `docker_stop_${container.name}`)
                .text("🔄 Restart", `docker_restart_${container.name}`)
                .row();
    }

    if (totalPages > 1) {
        if (page > 0) keyboard.text("◀️ Prev", `docker_page_${page - 1}`);
        if (page < totalPages - 1) keyboard.text("▶️ Next", `docker_page_${page + 1}`);
        keyboard.row();
    }

    keyboard.text("🔄 Refresh", "docker_refresh").row();

    return { text, keyboard };
};

/**
 * Shows list of running Docker containers with Stop/Restart buttons
 */
export const dockerMenuHandler = async (ctx: Context) => {
    if (!(await isAdmin(ctx))) return;

    try {
        const { text, keyboard } = await buildDockerMessage();
        await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
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
        const chatId = ctx.callbackQuery?.message?.chat.id;
        const messageId = ctx.callbackQuery?.message?.message_id;

        const msgText = ctx.callbackQuery?.message?.text || "";
        let currentPage = 0;
        const match = msgText.match(/Page (\d+)\//);
        if (match) {
            currentPage = parseInt(match[1], 10) - 1;
        }

        const editMessage = async (page: number) => {
            if (chatId && messageId) {
                const { text, keyboard } = await buildDockerMessage(page);
                await ctx.api.editMessageText(chatId, messageId, text, {
                    parse_mode: "HTML",
                    reply_markup: keyboard,
                });
            }
        };

        switch (action) {
            case "page": {
                const page = parseInt(params[0], 10) || 0;
                await editMessage(page);
                await ctx.answerCallbackQuery();
                break;
            }

            case "stop": {
                const name = params.join("_");
                const result = await dockerStop(name);
                await ctx.answerCallbackQuery({ text: result.message });
                if (result.success) await editMessage(currentPage);
                break;
            }

            case "restart": {
                const name = params.join("_");
                const result = await dockerRestart(name);
                await ctx.answerCallbackQuery({ text: result.message });
                if (result.success) await editMessage(currentPage);
                break;
            }

            case "refresh": {
                await ctx.answerCallbackQuery({ text: "🔄 Refreshing..." });
                await editMessage(currentPage);
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
