import { Context, InlineKeyboard, Keyboard } from "grammy";
import logger from "../core/logger";
import { UserState } from "../core/enums";
import { getUserState, setUserState, getUserById } from "../services/userDbServices";
import { menuKeyboard, menuOptions, adminMainMenu } from "../core/keyboards";
import { isAdmin } from "../core/adminCheck";

// Import feature handlers
import { pm2MenuHandler, pm2CallbackHandler } from "./pm2Handlers";
import { tmuxMenuHandler, tmuxCallbackHandler } from "./tmuxHandlers";
import { dockerMenuHandler, dockerCallbackHandler } from "./dockerHandlers";
import { nginxMenuHandler, nginxCallbackHandler, nginxMessageHandler } from "./nginxHandlers";
import { mysqlMenuHandler, mysqlCallbackHandler, mysqlMessageHandler } from "./mysqlHandlers";
import { bashStartHandler, bashMessageHandler, bashCallbackHandler } from "./bashHandlers";
import { fileExplorerMenuHandler, fileExplorerCallbackHandler, fileExplorerMessageHandler } from "./fileExplorerHandlers";
import { gitMenuHandler, gitCallbackHandler, gitMessageHandler } from "./gitHandlers";

export const startHandler = async (ctx: Context, start = true) => {
    let userId = ctx.from.id;

    let setState = await setUserState(userId, UserState.start);

    if (!setState.success) {
        await ctx.reply(setState.message);
        return;
    }

    // Check if user is admin
    let user = await getUserById(userId);
    if (user && user.isAdmin) {
        await ctx.reply("🖥️ *Server Manager Bot*\n\nWelcome, Admin! Choose a tool:", {
            parse_mode: "Markdown",
            reply_markup: menuKeyboard(),
        });
    } else {
        await ctx.reply("👋 Welcome!\n\nThis bot is for server management.\nUse /login <username> <password> to authenticate as admin.");
    }
};


export const callBackHandler = async (ctx: Context) => {
    let userId = ctx.from?.id as number;
    let callBackData = ctx.callbackQuery?.data;
    let callBackq = callBackData.split("_");

    logger.info(`User ${userId} sent a callback query: ${callBackData}`);

    const prefix = callBackq[0];
    const action = callBackq[1];
    const params = callBackq.slice(2);

    switch (prefix) {
        case "menu":
            // Main menu navigation
            await handleMenuCallback(ctx, action);
            break;
        case "pm2":
            await pm2CallbackHandler(ctx, action, params);
            break;
        case "tmux":
            await tmuxCallbackHandler(ctx, action, params);
            break;
        case "docker":
            await dockerCallbackHandler(ctx, action, params);
            break;
        case "nginx":
            await nginxCallbackHandler(ctx, action, params);
            break;
        case "mysql":
            await mysqlCallbackHandler(ctx, action, params);
            break;
        case "bash":
            await bashCallbackHandler(ctx, action, params);
            break;
        case "fe":
            await fileExplorerCallbackHandler(ctx, action, params);
            break;
        case "git":
            await gitCallbackHandler(ctx, action, params);
            break;
        default:
            await ctx.answerCallbackQuery({ text: "Unknown action" });
            break;
    }
}

const handleMenuCallback = async (ctx: Context, action: string) => {
    if (!(await isAdmin(ctx))) return;

    await ctx.answerCallbackQuery();

    switch (action) {
        case "bash":
            await bashStartHandler(ctx);
            break;
        case "pm2":
            await pm2MenuHandler(ctx);
            break;
        case "tmux":
            await tmuxMenuHandler(ctx);
            break;
        case "docker":
            await dockerMenuHandler(ctx);
            break;
        case "nginx":
            await nginxMenuHandler(ctx);
            break;
        case "mysql":
            await mysqlMenuHandler(ctx);
            break;
        case "files":
            await fileExplorerMenuHandler(ctx);
            break;
        case "git":
            await gitMenuHandler(ctx);
            break;
    }
};

export const cancelHandler = async (ctx: Context) => {
    let userId = ctx.from.id;

    let state = await getUserState(userId);

    if (!state) {
        await ctx.reply("❌ Error getting your state.");
        return;
    }

    logger.info(`User ${userId} is trying to cancel in state: ${state}`);

    let setState = await setUserState(userId, UserState.start);

    if (!setState.success) {
        await ctx.reply(setState.message);
        return;
    }

    await startHandler(ctx);
};


export const messagesHandler = async (ctx: Context) => {
    let text = ctx.message?.text;

    // Handle menu keyboard text buttons
    switch (text) {
        case menuOptions.bash:
            return await bashStartHandler(ctx);
        case menuOptions.pm2:
            return await pm2MenuHandler(ctx);
        case menuOptions.tmux:
            return await tmuxMenuHandler(ctx);
        case menuOptions.docker:
            return await dockerMenuHandler(ctx);
        case menuOptions.nginx:
            return await nginxMenuHandler(ctx);
        case menuOptions.mysql:
            return await mysqlMenuHandler(ctx);
        case menuOptions.files:
            return await fileExplorerMenuHandler(ctx);
        case menuOptions.git:
            return await gitMenuHandler(ctx);
    }


    let state = await getUserState(ctx.from.id);

    if (!state) {
        await ctx.reply("❌ Something went wrong.");
        return;
    }

    logger.info(`User ${ctx.from.id} sent a message in state: ${state}`);

    switch (state) {
        // Bash session - forward all messages to bash handler
        case UserState.bash_active:
            return await bashMessageHandler(ctx);

        // Nginx multi-step flows
        case UserState.nginx_add_port_to_url_port:
        case UserState.nginx_add_port_to_url_url:
        case UserState.nginx_add_port_to_folder_port:
        case UserState.nginx_add_port_to_folder_path:
        case UserState.nginx_add_domain_to_url_domain:
        case UserState.nginx_add_domain_to_url_url:
        case UserState.nginx_add_domain_to_folder_domain:
        case UserState.nginx_add_domain_to_folder_path:
            return await nginxMessageHandler(ctx, state);

        // MySQL multi-step flows
        case UserState.mysql_create_db:
        case UserState.mysql_run_query:
            return await mysqlMessageHandler(ctx, state);

        // File Explorer multi-step flows
        case UserState.file_explorer_create_folder:
        case UserState.file_explorer_create_file:
        case UserState.file_explorer_create_file_content:
            return await fileExplorerMessageHandler(ctx, state);

        // Git multi-step flows
        case UserState.git_commit_msg:
        case UserState.git_branch_name:
        case UserState.git_remote_name:
        case UserState.git_remote_url:
            return await gitMessageHandler(ctx, state);

        default:
            return await ctx.reply("🤔 Not sure what you mean.\n\nUse the menu buttons or /start to go back to the main menu.");
    }
};