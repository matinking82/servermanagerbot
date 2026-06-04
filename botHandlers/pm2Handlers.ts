import { Context, InlineKeyboard } from "grammy";
import logger from "../core/logger";
import { isAdmin } from "../core/adminCheck";
import { pm2List, pm2Start, pm2Stop, pm2Restart, pm2Logs } from "../services/pm2Services";

/**
 * Build the PM2 process list message text and inline keyboard.
 */
const buildPm2Message = async (): Promise<{ text: string; keyboard: InlineKeyboard }> => {
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

    let text = "📋 *PM2 Processes*\n\n";

    const keyboard = new InlineKeyboard();

    for (const proc of processes) {
        const statusEmoji =
            proc.status === "online" ? "🟢" : proc.status === "stopped" ? "🔴" : "🟡";

        text += `${statusEmoji} *${proc.name}* (id: ${proc.id})\n`;
        text += `   CPU: ${proc.cpu} | Mem: ${proc.memory} | Uptime: ${proc.uptime}\n\n`;

        keyboard
            .text("▶️ Start", `pm2_start_${proc.id}`)
            .text("⏹ Stop", `pm2_stop_${proc.id}`)
            .text("🔄 Restart", `pm2_restart_${proc.id}`)
            .text("📋 Logs", `pm2_logs_${proc.id}`)
            .row();
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

        switch (action) {
            case "start": {
                const result = await pm2Start(params[0]);
                await ctx.answerCallbackQuery({ text: result.message });

                // Refresh the process list
                if (chatId && messageId) {
                    const { text, keyboard } = await buildPm2Message();
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
                    const { text, keyboard } = await buildPm2Message();
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
                    const { text, keyboard } = await buildPm2Message();
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
                    const { text, keyboard } = await buildPm2Message();
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
