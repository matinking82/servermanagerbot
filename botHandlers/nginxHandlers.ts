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

/**
 * Shows list of nginx sites from /etc/nginx/sites-enabled
 */
export const nginxMenuHandler = async (ctx: Context) => {
    if (!(await isAdmin(ctx))) return;

    try {
        const result = await nginxList();

        if (!result.success) {
            await ctx.reply(`❌ ${result.message}`);
            return;
        }

        const kb = new InlineKeyboard();

        if (result.sites.length === 0) {
            let message = "🌐 <b>Nginx Sites</b>\n\nNo sites found in sites-enabled.";
            kb.text("🔄 Reload Nginx", "nginx_reload").row();
            kb.text("➕ Add New", "nginx_add").text("🔄 Refresh", "nginx_refresh").row();
            await ctx.reply(message, { parse_mode: "HTML", reply_markup: kb });
            return;
        }

        let message = "🌐 <b>Nginx Sites</b>\n\n";

        for (const site of result.sites) {
            message += `📄 <b>${site.filename}</b>\n`;
            if (site.listenPort) message += `   Port: ${site.listenPort}\n`;
            if (site.serverName) message += `   Domain: ${site.serverName}\n`;
            if (site.proxyPass) message += `   Proxy: ${site.proxyPass}\n`;
            if (site.root) message += `   Root: ${site.root}\n`;
            message += "\n";

            kb.text("🗑 Delete", `nginx_del_${site.filename}`).row();
        }

        kb.text("🔄 Reload Nginx", "nginx_reload").row();
        kb.text("➕ Add New", "nginx_add").text("🔄 Refresh", "nginx_refresh").row();

        await ctx.reply(message, { parse_mode: "HTML", reply_markup: kb });
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
        switch (action) {
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
                    await nginxMenuHandler(ctx);
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
                await nginxMenuHandler(ctx);
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
