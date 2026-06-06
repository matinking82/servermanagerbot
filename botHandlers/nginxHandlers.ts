import { Context, InlineKeyboard } from "grammy";
import { isAdmin } from "../core/adminCheck";
import logger from "../core/logger";
import { UserState } from "../core/enums";
import { getUserData, setUserData, setUserState } from "../services/userDbServices";
import {
    nginxList,
    nginxDelete,
    nginxReload,
    nginxCreatePortToUrl,
    nginxCreatePortToFolder,
    nginxCreateDomainToUrl,
    nginxCreateDomainToFolder,
} from "../services/nginxServices";

const PAGE_SIZE = 5;

const buildNginxMessage = async (page: number = 0): Promise<{ text: string; keyboard: InlineKeyboard }> => {
    const result = await nginxList();

    if (!result.success) {
        return {
            text: `❌ ${result.message}`,
            keyboard: new InlineKeyboard().text("🔄 Refresh", "nginx_refresh"),
        };
    }

    const kb = new InlineKeyboard();
    const sites = result.sites;

    if (sites.length === 0) {
        let text = "🌐 <b>Nginx Sites</b>\n\nNo sites found in sites-enabled.";
        kb.text("🔄 Reload Nginx", "nginx_reload").row();
        kb.text("➕ Add New", "nginx_add").text("🔄 Refresh", "nginx_refresh").row();
        return { text, keyboard: kb };
    }

    const totalSites = sites.length;
    const totalPages = Math.ceil(totalSites / PAGE_SIZE);

    if (page >= totalPages && totalPages > 0) page = totalPages - 1;
    if (page < 0) page = 0;

    let text = `🌐 <b>Nginx Sites</b> (Page ${page + 1}/${totalPages})\n\n`;

    const currentSites = sites.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    for (const site of currentSites) {
        text += `📄 <b>${site.filename}</b>\n`;
        if (site.listenPort) text += `   Port: ${site.listenPort}\n`;
        if (site.serverName) text += `   Domain: ${site.serverName}\n`;
        if (site.proxyPass) text += `   Proxy: ${site.proxyPass}\n`;
        if (site.root) text += `   Root: ${site.root}\n`;
        text += "\n";

        kb.text(`📄 ${site.filename}`, `nginx_refresh`).text("🗑", `nginx_del_${site.filename}`).row();
    }

    if (totalPages > 1) {
        if (page > 0) kb.text("◀️ Prev", `nginx_page_${page - 1}`);
        if (page < totalPages - 1) kb.text("▶️ Next", `nginx_page_${page + 1}`);
        kb.row();
    }

    kb.text("🔄 Reload Nginx", "nginx_reload").row();
    kb.text("➕ Add New", "nginx_add").text("🔄 Refresh", "nginx_refresh").row();

    return { text, keyboard: kb };
};

/**
 * Shows list of nginx sites from /etc/nginx/sites-enabled
 */
export const nginxMenuHandler = async (ctx: Context) => {
    if (!(await isAdmin(ctx))) return;

    try {
        const { text, keyboard } = await buildNginxMessage();
        await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
    } catch (error) {
        logger.error(error, { section: "nginxMenuHandler" });
        await ctx.reply("❌ Error loading Nginx menu.");
    }
};

/**
 * Handles Nginx callback actions: del, delconfirm, delcancel, reload, add, type, refresh
 */
export const nginxCallbackHandler = async (ctx: Context, action: string, params: string[]) => {
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
                const { text, keyboard } = await buildNginxMessage(page);
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

            case "del": {
                const filename = params.join("_");
                const kb = new InlineKeyboard();
                kb.text("✅ Yes, delete", `nginx_delconfirm_${filename}`)
                  .text("❌ Cancel", "nginx_delcancel")
                  .row();
                await ctx.answerCallbackQuery();
                await ctx.reply(
                    `⚠️ Are you sure you want to delete <b>${filename}</b>?`,
                    { parse_mode: "HTML", reply_markup: kb }
                );
                break;
            }

            case "delconfirm": {
                const filename = params.join("_");
                const result = await nginxDelete(filename);
                await ctx.answerCallbackQuery({ text: result.message });
                if (result.success) {
                    await ctx.reply(result.message);
                    await editMessage(currentPage);
                } else {
                    await ctx.reply(result.message);
                }
                break;
            }

            case "delcancel": {
                await ctx.answerCallbackQuery({ text: "Cancelled" });
                break;
            }

            case "reload": {
                const result = await nginxReload();
                await ctx.answerCallbackQuery({ text: result.message });
                await ctx.reply(result.message);
                break;
            }

            case "add": {
                await ctx.answerCallbackQuery();
                const kb = new InlineKeyboard();
                kb.text("Port → URL", "nginx_type_porturl")
                  .text("Port → Folder", "nginx_type_portfolder")
                  .row();
                kb.text("Domain → URL", "nginx_type_domainurl")
                  .text("Domain → Folder", "nginx_type_domainfolder")
                  .row();
                await ctx.reply("Select the type of nginx config to create:", { reply_markup: kb });
                break;
            }

            case "type": {
                const type = params[0];
                const userId = ctx.from?.id as number;
                await ctx.answerCallbackQuery();

                switch (type) {
                    case "porturl": {
                        await setUserState(userId, UserState.nginx_add_port_to_url_port);
                        await ctx.reply("🔢 Enter the port number to listen on:");
                        break;
                    }
                    case "portfolder": {
                        await setUserState(userId, UserState.nginx_add_port_to_folder_port);
                        await ctx.reply("🔢 Enter the port number to listen on:");
                        break;
                    }
                    case "domainurl": {
                        await setUserState(userId, UserState.nginx_add_domain_to_url_domain);
                        await ctx.reply("🌐 Enter the domain name (e.g. example.com):");
                        break;
                    }
                    case "domainfolder": {
                        await setUserState(userId, UserState.nginx_add_domain_to_folder_domain);
                        await ctx.reply("🌐 Enter the domain name (e.g. example.com):");
                        break;
                    }
                    default: {
                        await ctx.reply("❌ Unknown type.");
                        break;
                    }
                }
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
        logger.error(error, { section: "nginxCallbackHandler" });
        await ctx.answerCallbackQuery({ text: "❌ Error processing action" });
    }
};

/**
 * Handles text input for multi-step nginx config creation based on user state
 */
export const nginxMessageHandler = async (ctx: Context, state: string) => {
    if (!(await isAdmin(ctx))) return;

    try {
        const userId = ctx.from?.id as number;
        const text = ctx.message?.text?.trim();

        if (!text) {
            await ctx.reply("❌ Please enter a valid value.");
            return;
        }

        switch (state) {
            // Port → URL flow
            case UserState.nginx_add_port_to_url_port: {
                const userData = await getUserData(userId);
                await setUserData(userId, { ...userData.data, nginxPort: text });
                await setUserState(userId, UserState.nginx_add_port_to_url_url);
                await ctx.reply("🔗 Enter the target URL (e.g. http://localhost:3000):");
                break;
            }

            case UserState.nginx_add_port_to_url_url: {
                const userData = await getUserData(userId);
                const port = userData.data?.nginxPort;
                const result = await nginxCreatePortToUrl(port, text);
                await ctx.reply(result.message);
                await setUserState(userId, UserState.start);
                await setUserData(userId, {});
                break;
            }

            // Port → Folder flow
            case UserState.nginx_add_port_to_folder_port: {
                const userData = await getUserData(userId);
                await setUserData(userId, { ...userData.data, nginxPort: text });
                await setUserState(userId, UserState.nginx_add_port_to_folder_path);
                await ctx.reply("📂 Enter the folder path (e.g. /var/www/html):");
                break;
            }

            case UserState.nginx_add_port_to_folder_path: {
                const userData = await getUserData(userId);
                const port = userData.data?.nginxPort;
                const result = await nginxCreatePortToFolder(port, text);
                await ctx.reply(result.message);
                await setUserState(userId, UserState.start);
                await setUserData(userId, {});
                break;
            }

            // Domain → URL flow
            case UserState.nginx_add_domain_to_url_domain: {
                const userData = await getUserData(userId);
                await setUserData(userId, { ...userData.data, nginxDomain: text });
                await setUserState(userId, UserState.nginx_add_domain_to_url_url);
                await ctx.reply("🔗 Enter the target URL (e.g. http://localhost:3000):");
                break;
            }

            case UserState.nginx_add_domain_to_url_url: {
                const userData = await getUserData(userId);
                const domain = userData.data?.nginxDomain;
                const result = await nginxCreateDomainToUrl(domain, text);
                await ctx.reply(result.message);
                await setUserState(userId, UserState.start);
                await setUserData(userId, {});
                break;
            }

            // Domain → Folder flow
            case UserState.nginx_add_domain_to_folder_domain: {
                const userData = await getUserData(userId);
                await setUserData(userId, { ...userData.data, nginxDomain: text });
                await setUserState(userId, UserState.nginx_add_domain_to_folder_path);
                await ctx.reply("📂 Enter the folder path (e.g. /var/www/html):");
                break;
            }

            case UserState.nginx_add_domain_to_folder_path: {
                const userData = await getUserData(userId);
                const domain = userData.data?.nginxDomain;
                const result = await nginxCreateDomainToFolder(domain, text);
                await ctx.reply(result.message);
                await setUserState(userId, UserState.start);
                await setUserData(userId, {});
                break;
            }

            default: {
                await ctx.reply("❌ Unknown state. Use /start to reset.");
                break;
            }
        }
    } catch (error) {
        logger.error(error, { section: "nginxMessageHandler" });
        await ctx.reply("❌ Error processing your input.");
    }
};
