import { Context, InlineKeyboard } from "grammy";
import { isAdmin } from "../core/adminCheck";
import { createBashSession, sendBashCommand, destroyBashSession, hasBashSession } from "../services/bashServices";
import { setUserState } from "../services/userDbServices";
import { UserState } from "../core/enums";
import logger from "../core/logger";

const exitKeyboard = new InlineKeyboard().text("❌ Exit Session", "bash_exit");

/**
 * Start a new interactive bash session for the user
 */
export const bashStartHandler = async (ctx: Context) => {
    if (!(await isAdmin(ctx))) return;

    try {
        let userId = ctx.from?.id as number;

        let result = createBashSession(userId);

        if (!result.success) {
            await ctx.reply(result.message);
            return;
        }

        let setState = await setUserState(userId, UserState.bash_active);

        if (!setState.success) {
            destroyBashSession(userId);
            await ctx.reply(setState.message);
            return;
        }

        await ctx.reply(result.message, { reply_markup: exitKeyboard });
    } catch (error) {
        logger.error(error, { section: "bashStartHandler" });
        await ctx.reply("❌ Error starting bash session.");
    }
};

/**
 * Handle incoming messages while user is in an active bash session
 */
export const bashMessageHandler = async (ctx: Context) => {
    if (!(await isAdmin(ctx))) return;

    try {
        let userId = ctx.from?.id as number;
        let text = ctx.message?.text;

        if (!text) return;

        // Handle exit command
        if (text === "exit" || text === "/exit") {
            destroyBashSession(userId);
            await setUserState(userId, UserState.start);
            await ctx.reply("🖥️ Bash session ended.");
            return;
        }

        let result = await sendBashCommand(userId, text);

        // If session was closed (timed out, crashed, etc.), reset state
        if (result.closed) {
            await setUserState(userId, UserState.start);
            await ctx.reply("⚠️ " + result.output);
            return;
        }

        let output = result.output;

        // Truncate long output to last 4000 chars
        if (output.length > 4000) {
            output = "...(truncated)\n" + output.slice(-4000);
        }

        await ctx.reply(`<pre>${escapeHtml(output)}</pre>`, {
            parse_mode: "HTML",
            reply_markup: exitKeyboard,
        });
    } catch (error) {
        logger.error(error, { section: "bashMessageHandler" });
        await ctx.reply("❌ Error executing command.");
    }
};

/**
 * Handle callback queries for bash session actions
 */
export const bashCallbackHandler = async (ctx: Context, action: string, params: string[]) => {
    if (!(await isAdmin(ctx))) return;

    try {
        let userId = ctx.from?.id as number;

        switch (action) {
            case "exit":
                destroyBashSession(userId);
                await setUserState(userId, UserState.start);
                await ctx.editMessageText("🖥️ Bash session ended.");
                await ctx.answerCallbackQuery({ text: "Session ended" });
                break;

            default:
                await ctx.answerCallbackQuery({ text: "Unknown action" });
                break;
        }
    } catch (error) {
        logger.error(error, { section: "bashCallbackHandler" });
        await ctx.answerCallbackQuery({ text: "❌ Error processing action" });
    }
};

/**
 * Escape HTML special characters for Telegram HTML parse mode
 */
const escapeHtml = (text: string): string => {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
};
