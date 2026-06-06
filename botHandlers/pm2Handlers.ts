import { Context, InlineKeyboard } from "grammy";
import logger from "../core/logger";
import { isAdmin } from "../core/adminCheck";
import { pm2List, pm2Start, pm2Stop, pm2Restart, pm2Logs, pm2Delete } from "../services/pm2Services";

/**
 * Build the PM2 process list message text and inline keyboard.
 */
const PAGE_SIZE = 5;

const buildPm2Message = async (page: number = 0): Promise<{ text: string; keyboard: InlineKeyboard }> => {
    const result = await pm2List();

    if (!result.success) {
        return {
            text: `❌ Failed to fetch PM2 processes:\n${result.message}`,
            keyboard: new InlineKeyboard().text("🔄 Refresh", "pm2_refresh"),
        };
    }

    const processes = result.processes;

    if (processes.length === 0) {
        return {
            text: "📋 *PM2 Processes*\n\nNo processes found.",
            keyboard: new InlineKeyboard().text("🔄 Refresh", "pm2_refresh"),
        };
    }

    const totalProcesses = processes.length;
    const totalPages = Math.ceil(totalProcesses / PAGE_SIZE);
    
    if (page >= totalPages && totalPages > 0) page = totalPages - 1;
    if (page < 0) page = 0;

    let text = `📋 *PM2 Processes* (Page ${page + 1}/${totalPages})\n\n`;

    const keyboard = new InlineKeyboard();

    const currentProcesses = processes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    for (const proc of currentProcesses) {
        const statusEmoji =
            proc.status === "online" ? "🟢" : proc.status === "stopped" ? "🔴" : "🟡";

        text += `${statusEmoji} *${proc.name}* (id: ${proc.id})\n`;
        text += `   CPU: ${proc.cpu} | Mem: ${proc.memory} | Uptime: ${proc.uptime}\n\n`;

        keyboard
            .text(`🆔 ${proc.id}`, `pm2_refresh`)
            .text("▶️", `pm2_start_${proc.id}`)
            .text("⏹", `pm2_stop_${proc.id}`)
            .text("🔄", `pm2_restart_${proc.id}`)
            .text("📋", `pm2_logs_${proc.id}`)
            .text("🗑", `pm2_delete_${proc.id}`)
            .row();
    }

    if (totalPages > 1) {
        if (page > 0) keyboard.text("◀️ Prev", `pm2_page_${page - 1}`);
        if (page < totalPages - 1) keyboard.text("▶️ Next", `pm2_page_${page + 1}`);
        keyboard.row();
    }

    keyboard.text("🔄 Refresh", "pm2_refresh");

    return { text, keyboard };
};

/**
 * Shows a list of all PM2 processes with inline action buttons.
 */
export const pm2MenuHandler = async (ctx: Context) => {
    if (!(await isAdmin(ctx))) return;

    try {
        const { text, keyboard } = await buildPm2Message();

        await ctx.reply(text, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
        });
    } catch (error) {
        logger.error(error, { section: "pm2MenuHandler" });
        await ctx.reply("❌ Error displaying PM2 processes.");
    }
};

/**
 * Handles all PM2-related callback queries.
 */
export const pm2CallbackHandler = async (ctx: Context, action: string, params: string[]) => {
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

        switch (action) {
            case "page": {
                const page = parseInt(params[0], 10) || 0;
                if (chatId && messageId) {
                    const { text, keyboard } = await buildPm2Message(page);
                    await ctx.api.editMessageText(chatId, messageId, text, {
                        parse_mode: "Markdown",
                        reply_markup: keyboard,
                    });
                }
                await ctx.answerCallbackQuery();
                break;
            }

            case "start": {
                const result = await pm2Start(params[0]);
                await ctx.answerCallbackQuery({ text: result.message });

                // Refresh the process list
                if (chatId && messageId) {
                    const { text, keyboard } = await buildPm2Message(currentPage);
                    await ctx.api.editMessageText(chatId, messageId, text, {
                        parse_mode: "Markdown",
                        reply_markup: keyboard,
                    });
                }
                break;
            }

            case "stop": {
                const result = await pm2Stop(params[0]);
                await ctx.answerCallbackQuery({ text: result.message });

                if (chatId && messageId) {
                    const { text, keyboard } = await buildPm2Message(currentPage);
                    await ctx.api.editMessageText(chatId, messageId, text, {
                        parse_mode: "Markdown",
                        reply_markup: keyboard,
                    });
                }
                break;
            }

            case "restart": {
                const result = await pm2Restart(params[0]);
                await ctx.answerCallbackQuery({ text: result.message });

                if (chatId && messageId) {
                    const { text, keyboard } = await buildPm2Message(currentPage);
                    await ctx.api.editMessageText(chatId, messageId, text, {
                        parse_mode: "Markdown",
                        reply_markup: keyboard,
                    });
                }
                break;
            }

            case "delete": {
                const result = await pm2Delete(params[0]);
                await ctx.answerCallbackQuery({ text: result.message });

                if (chatId && messageId) {
                    const { text, keyboard } = await buildPm2Message(currentPage);
                    await ctx.api.editMessageText(chatId, messageId, text, {
                        parse_mode: "Markdown",
                        reply_markup: keyboard,
                    });
                }
                break;
            }

            case "logs": {
                const result = await pm2Logs(params[0]);
                await ctx.answerCallbackQuery();

                if (!result.success) {
                    await ctx.reply(`❌ Failed to fetch logs: ${result.message}`);
                    return;
                }

                let output = result.output;
                if (output.length > 4000) {
                    output = output.substring(output.length - 3900);
                    output = "⚠️ Output truncated (showing last portion):\n\n" + output;
                }

                await ctx.reply(`📋 *Logs for process ${params[0]}:*\n\`\`\`\n${output}\n\`\`\``, {
                    parse_mode: "Markdown",
                });
                break;
            }

            case "refresh": {
                await ctx.answerCallbackQuery({ text: "🔄 Refreshing..." });

                if (chatId && messageId) {
                    const { text, keyboard } = await buildPm2Message(currentPage);
                    await ctx.api.editMessageText(chatId, messageId, text, {
                        parse_mode: "Markdown",
                        reply_markup: keyboard,
                    });
                }
                break;
            }

            default: {
                await ctx.answerCallbackQuery({ text: "❌ Unknown action" });
                break;
            }
        }
    } catch (error) {
        logger.error(error, { section: "pm2CallbackHandler" });
        await ctx.answerCallbackQuery({ text: "❌ An error occurred" });
    }
};
