import { Context, InlineKeyboard } from "grammy";
import logger from "../core/logger";
import { isAdmin } from "../core/adminCheck";
import { tmuxList, tmuxKill } from "../services/tmuxServices";

/**
 * Build the tmux session list message text and inline keyboard.
 */
const buildTmuxMessage = async (): Promise<{ text: string; keyboard: InlineKeyboard }> => {
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

    let text = "📋 *Tmux Sessions*\n\n";

    const keyboard = new InlineKeyboard();

    for (const session of sessions) {
        const attachedEmoji = session.attached ? "🔗" : "💤";

        text += `${attachedEmoji} *${session.name}*\n`;
        text += `   Windows: ${session.windows} | Created: ${session.created}\n`;
        text += `   Status: ${session.attached ? "Attached" : "Detached"}\n\n`;

        keyboard.text(`❌ Kill ${session.name}`, `tmux_kill_${session.name}`).row();
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

        switch (action) {
            case "kill": {
                const sessionName = params[0];
                const result = await tmuxKill(sessionName);
                await ctx.answerCallbackQuery({ text: result.message });

                // Refresh the session list
                if (chatId && messageId) {
                    const { text, keyboard } = await buildTmuxMessage();
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
                    const { text, keyboard } = await buildTmuxMessage();
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
