import { Context, InlineKeyboard } from "grammy";
import logger from "../core/logger";
import { isAdmin } from "../core/adminCheck";
import { tmuxList, tmuxKill } from "../services/tmuxServices";

/**
 * Build the tmux session list message text and inline keyboard.
 */
const PAGE_SIZE = 5;

const buildTmuxMessage = async (page: number = 0): Promise<{ text: string; keyboard: InlineKeyboard }> => {
    const result = await tmuxList();

    if (!result.success) {
        return {
            text: `❌ Failed to fetch tmux sessions:\n${result.message}`,
            keyboard: new InlineKeyboard().text("🔄 Refresh", "tmux_refresh"),
        };
    }

    const sessions = result.sessions;

    if (sessions.length === 0) {
        return {
            text: "📋 *Tmux Sessions*\n\nNo active sessions found.",
            keyboard: new InlineKeyboard().text("🔄 Refresh", "tmux_refresh"),
        };
    }

    const totalSessions = sessions.length;
    const totalPages = Math.ceil(totalSessions / PAGE_SIZE);

    if (page >= totalPages && totalPages > 0) page = totalPages - 1;
    if (page < 0) page = 0;

    let text = `📋 *Tmux Sessions* (Page ${page + 1}/${totalPages})\n\n`;

    const keyboard = new InlineKeyboard();

    const currentSessions = sessions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    for (const session of currentSessions) {
        const attachedEmoji = session.attached ? "🔗" : "💤";

        text += `${attachedEmoji} *${session.name}*\n`;
        text += `   Windows: ${session.windows} | Created: ${session.created}\n`;
        text += `   Status: ${session.attached ? "Attached" : "Detached"}\n\n`;

        keyboard.text(`❌ Kill ${session.name}`, `tmux_kill_${session.name}`).row();
    }

    if (totalPages > 1) {
        if (page > 0) keyboard.text("◀️ Prev", `tmux_page_${page - 1}`);
        if (page < totalPages - 1) keyboard.text("▶️ Next", `tmux_page_${page + 1}`);
        keyboard.row();
    }

    keyboard.text("🔄 Refresh", "tmux_refresh");

    return { text, keyboard };
};

/**
 * Shows a list of all tmux sessions with inline action buttons.
 */
export const tmuxMenuHandler = async (ctx: Context) => {
    if (!(await isAdmin(ctx))) return;

    try {
        const { text, keyboard } = await buildTmuxMessage();

        await ctx.reply(text, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
        });
    } catch (error) {
        logger.error(error, { section: "tmuxMenuHandler" });
        await ctx.reply("❌ Error displaying tmux sessions.");
    }
};

/**
 * Handles all tmux-related callback queries.
 */
export const tmuxCallbackHandler = async (ctx: Context, action: string, params: string[]) => {
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
                    const { text, keyboard } = await buildTmuxMessage(page);
                    await ctx.api.editMessageText(chatId, messageId, text, {
                        parse_mode: "Markdown",
                        reply_markup: keyboard,
                    });
                }
                await ctx.answerCallbackQuery();
                break;
            }

            case "kill": {
                const sessionName = params[0];
                const result = await tmuxKill(sessionName);
                await ctx.answerCallbackQuery({ text: result.message });

                // Refresh the session list
                if (chatId && messageId) {
                    const { text, keyboard } = await buildTmuxMessage(currentPage);
                    await ctx.api.editMessageText(chatId, messageId, text, {
                        parse_mode: "Markdown",
                        reply_markup: keyboard,
                    });
                }
                break;
            }

            case "refresh": {
                await ctx.answerCallbackQuery({ text: "🔄 Refreshing..." });

                if (chatId && messageId) {
                    const { text, keyboard } = await buildTmuxMessage(currentPage);
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
        logger.error(error, { section: "tmuxCallbackHandler" });
        await ctx.answerCallbackQuery({ text: "❌ An error occurred" });
    }
};
