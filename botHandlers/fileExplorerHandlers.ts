import { Context, InlineKeyboard, InputFile } from "grammy";
import { isAdmin } from "../core/adminCheck";
import { listDirectory, createFolder, createFile, updateFile, deleteItem, getFileInfo, formatFileSize } from "../services/fileExplorerServices";
import { getUserData, setUserData, setUserState } from "../services/userDbServices";
import { UserState } from "../core/enums";
import logger from "../core/logger";
import * as path from "path";

// --- Path Registry for handling long paths ---
const pathRegistry = new Map<string, string>();
let pathCounter = 0;

function encodePath(p: string): string {
    const b64 = Buffer.from(p).toString('base64url');
    if (b64.length <= 40) return b64;
    const key = 'p' + (pathCounter++);
    pathRegistry.set(key, p);
    return key;
}

export function decodePath(encoded: string): string {
    if (pathRegistry.has(encoded)) return pathRegistry.get(encoded)!;
    return Buffer.from(encoded, 'base64url').toString();
}

// --- Build directory listing keyboard ---
function buildDirectoryKeyboard(
    items: { name: string; isDirectory: boolean; size: number }[],
    currentPath: string,
    currentPage: number,
    totalPages: number
): InlineKeyboard {
    const kb = new InlineKeyboard();

    // File/folder items
    for (const item of items) {
        const fullPath = path.join(currentPath, item.name);
        const encoded = encodePath(fullPath);

        if (item.isDirectory) {
            kb.text(`📁 ${item.name}`, `fe_open_${encoded}_0`).row();
        } else {
            kb.text(`📄 ${item.name} (${formatFileSize(item.size)})`, `fe_file_${encoded}`).row();
        }
    }

    // Navigation row
    const navRow: { text: string; data: string }[] = [];

    // Parent button (if not at root)
    if (currentPath !== "/") {
        const parentPath = path.dirname(currentPath);
        const parentEncoded = encodePath(parentPath);
        navRow.push({ text: "⬆️ Parent", data: `fe_open_${parentEncoded}_0` });
    }

    // Pagination buttons
    if (totalPages > 1) {
        if (currentPage > 0) {
            const dirEncoded = encodePath(currentPath);
            navRow.push({ text: "◀️ Prev", data: `fe_page_${dirEncoded}_${currentPage - 1}` });
        }
        if (currentPage < totalPages - 1) {
            const dirEncoded = encodePath(currentPath);
            navRow.push({ text: "▶️ Next", data: `fe_page_${dirEncoded}_${currentPage + 1}` });
        }
    }

    if (navRow.length > 0) {
        for (const btn of navRow) {
            kb.text(btn.text, btn.data);
        }
        kb.row();
    }

    // Action buttons row 1: New Folder, New File
    const dirEncoded = encodePath(currentPath);
    kb.text("📁 New Folder", `fe_mkdir_${dirEncoded}`)
      .text("📄 New File", `fe_mkfile_${dirEncoded}`)
      .row();

    // Action buttons row 2: Refresh
    kb.text("🔄 Refresh", `fe_open_${dirEncoded}_${currentPage}`).row();

    return kb;
}

// --- Build header text ---
function buildHeaderText(currentPath: string, currentPage: number, totalPages: number, totalItems: number): string {
    let header = `📂 ${currentPath}`;
    if (totalPages > 1) {
        header += `\nPage ${currentPage + 1}/${totalPages}`;
    }
    header += `\n📊 ${totalItems} items`;
    return header;
}

/**
 * Lists files/folders with pagination
 */
export const fileExplorerMenuHandler = async (ctx: Context, dirPath: string = '/root', page: number = 0) => {
    try {
        if (!(await isAdmin(ctx))) return;

        const result = listDirectory(dirPath, page);

        if (!result.success) {
            await ctx.reply(result.message || "❌ Error listing directory");
            return;
        }

        const headerText = buildHeaderText(result.currentPath, result.currentPage, result.totalPages, result.totalItems);
        const keyboard = buildDirectoryKeyboard(result.items, result.currentPath, result.currentPage, result.totalPages);

        await ctx.reply(headerText, { reply_markup: keyboard });
    } catch (error) {
        logger.error(error, { section: "fileExplorerMenuHandler" });
        await ctx.reply("❌ Error opening file explorer");
    }
};

/**
 * Handles file explorer callback queries
 */
export const fileExplorerCallbackHandler = async (ctx: Context, action: string, params: string[]) => {
    try {
        if (!(await isAdmin(ctx))) return;

        switch (action) {
            case "open":
            case "page": {
                const dirPath = decodePath(params[0]);
                const page = params[1] ? parseInt(params[1], 10) : 0;

                const result = listDirectory(dirPath, page);

                if (!result.success) {
                    await ctx.answerCallbackQuery({ text: result.message || "❌ Error" });
                    return;
                }

                const headerText = buildHeaderText(result.currentPath, result.currentPage, result.totalPages, result.totalItems);
                const keyboard = buildDirectoryKeyboard(result.items, result.currentPath, result.currentPage, result.totalPages);

                await ctx.editMessageText(headerText, { reply_markup: keyboard });
                await ctx.answerCallbackQuery();
                break;
            }

            case "file": {
                const filePath = decodePath(params[0]);
                const fileInfo = getFileInfo(filePath);

                if (!fileInfo.success || !fileInfo.exists) {
                    await ctx.answerCallbackQuery({ text: "❌ File not found" });
                    return;
                }

                if (!fileInfo.isFile) {
                    await ctx.answerCallbackQuery({ text: "❌ Not a file" });
                    return;
                }

                await ctx.answerCallbackQuery();
                const encoded = encodePath(filePath);
                const kb = new InlineKeyboard()
                    .text("⬇️ Download", `fe_download_${encoded}`)
                    .text("✏️ Edit", `fe_edit_${encoded}`)
                    .row();
                const fileName = path.basename(filePath);
                await ctx.reply(`📄 File: ${fileName}\n\nWhat would you like to do?`, { reply_markup: kb });
                break;
            }

            case "download": {
                const filePath = decodePath(params[0]);
                const fileInfo = getFileInfo(filePath);

                if (!fileInfo.success || !fileInfo.exists || !fileInfo.isFile) {
                    await ctx.answerCallbackQuery({ text: "❌ File not found" });
                    return;
                }

                await ctx.answerCallbackQuery();
                await ctx.reply("📤 Sending file to you...");

                const fileName = path.basename(filePath);
                await ctx.replyWithDocument(new InputFile(filePath), {
                    caption: fileName,
                });
                break;
            }

            case "edit": {
                const filePath = decodePath(params[0]);
                const fileInfo = getFileInfo(filePath);

                if (!fileInfo.success || !fileInfo.exists || !fileInfo.isFile) {
                    await ctx.answerCallbackQuery({ text: "❌ File not found" });
                    return;
                }

                await ctx.answerCallbackQuery();
                const fileName = path.basename(filePath);
                await ctx.replyWithDocument(new InputFile(filePath), {
                    caption: `📄 Editing: ${fileName}\n\nSend the edited file back, or send the new text content for this file.`,
                });

                const userId = ctx.from?.id as number;
                const userData = await getUserData(userId);
                const data = userData.success ? (userData.data || {}) : {};
                data.fileExplorerEditPath = filePath;
                await setUserData(userId, data);
                await setUserState(userId, UserState.file_explorer_edit_file);
                break;
            }

            case "mkdir": {
                const dirPath = decodePath(params[0]);
                const userId = ctx.from?.id as number;

                // Save the directory path in user data
                const userData = await getUserData(userId);
                const data = userData.success ? (userData.data || {}) : {};
                data.fileExplorerPath = dirPath;
                await setUserData(userId, data);

                await setUserState(userId, UserState.file_explorer_create_folder);

                await ctx.answerCallbackQuery();
                await ctx.reply("📁 Enter the name for the new folder:\n\n(Send /cancel to cancel)");
                break;
            }

            case "mkfile": {
                const dirPath = decodePath(params[0]);
                const userId = ctx.from?.id as number;

                // Save the directory path in user data
                const userData = await getUserData(userId);
                const data = userData.success ? (userData.data || {}) : {};
                data.fileExplorerPath = dirPath;
                await setUserData(userId, data);

                await setUserState(userId, UserState.file_explorer_create_file);

                await ctx.answerCallbackQuery();
                await ctx.reply("📄 Enter the name for the new file:\n\n(Send /cancel to cancel)");
                break;
            }

            case "del": {
                const itemPath = decodePath(params[0]);
                const itemName = path.basename(itemPath);
                const parentDir = path.dirname(itemPath);

                const encodedItem = encodePath(itemPath);
                const encodedParent = encodePath(parentDir);

                const confirmKb = new InlineKeyboard()
                    .text("✅ Yes, delete", `fe_delconfirm_${encodedItem}`)
                    .text("❌ Cancel", `fe_delcancel_${encodedParent}`)
                    .row();

                await ctx.editMessageText(`⚠️ Are you sure you want to delete:\n\n🗑️ ${itemName}\n\nPath: ${itemPath}`, {
                    reply_markup: confirmKb,
                });
                await ctx.answerCallbackQuery();
                break;
            }

            case "delconfirm": {
                const itemPath = decodePath(params[0]);
                const parentDir = path.dirname(itemPath);

                const deleteResult = deleteItem(itemPath);

                if (!deleteResult.success) {
                    await ctx.answerCallbackQuery({ text: deleteResult.message });
                    return;
                }

                await ctx.answerCallbackQuery({ text: deleteResult.message });

                // Refresh parent directory
                const result = listDirectory(parentDir, 0);

                if (!result.success) {
                    await ctx.editMessageText(deleteResult.message);
                    return;
                }

                const headerText = buildHeaderText(result.currentPath, result.currentPage, result.totalPages, result.totalItems);
                const keyboard = buildDirectoryKeyboard(result.items, result.currentPath, result.currentPage, result.totalPages);

                await ctx.editMessageText(headerText, { reply_markup: keyboard });
                break;
            }

            case "delcancel": {
                const dirPath = decodePath(params[0]);

                const result = listDirectory(dirPath, 0);

                if (!result.success) {
                    await ctx.answerCallbackQuery({ text: result.message || "❌ Error" });
                    return;
                }

                const headerText = buildHeaderText(result.currentPath, result.currentPage, result.totalPages, result.totalItems);
                const keyboard = buildDirectoryKeyboard(result.items, result.currentPath, result.currentPage, result.totalPages);

                await ctx.editMessageText(headerText, { reply_markup: keyboard });
                await ctx.answerCallbackQuery();
                break;
            }

            default:
                await ctx.answerCallbackQuery({ text: "❌ Unknown action" });
                break;
        }
    } catch (error) {
        logger.error(error, { section: "fileExplorerCallbackHandler", action, params });
        try {
            await ctx.answerCallbackQuery({ text: "❌ An error occurred" });
        } catch {
            // callback may have already been answered
        }
    }
};

/**
 * Handles text messages and document uploads for file explorer states (create folder, create file)
 */
export const fileExplorerMessageHandler = async (ctx: Context, state: string) => {
    try {
        if (!(await isAdmin(ctx))) return;

        const userId = ctx.from?.id as number;
        const text = ctx.message?.text?.trim();

        // For states that require text (create folder and create file name)
        if ((state === UserState.file_explorer_create_folder || state === UserState.file_explorer_create_file) && !text) {
            await ctx.reply("❌ Please send a valid name");
            return;
        }

        // Get user data to retrieve the current directory path
        const userData = await getUserData(userId);
        if (!userData.success || !userData.data?.fileExplorerPath) {
            await ctx.reply("❌ Error: directory context lost. Please start over.");
            await setUserState(userId, UserState.start);
            return;
        }

        const dirPath = userData.data.fileExplorerPath;

        switch (state) {
            case UserState.file_explorer_create_folder: {
                if (!text) return;
                const result = createFolder(dirPath, text);
                await ctx.reply(result.message);

                // Reset state
                await setUserState(userId, UserState.start);

                // Show directory listing
                await fileExplorerMenuHandler(ctx, dirPath);
                break;
            }

            case UserState.file_explorer_create_file: {
                if (!text) return;
                // Save the file name in user data
                const data = userData.data || {};
                data.fileExplorerFileName = text;
                await setUserData(userId, data);

                await setUserState(userId, UserState.file_explorer_create_file_content);
                await ctx.reply("✍️ Send the text content for the new file, or upload a document:");
                break;
            }

            case UserState.file_explorer_create_file_content: {
                const fileName = userData.data?.fileExplorerFileName;
                if (!fileName) {
                    await ctx.reply("❌ Error: filename context lost. Please start over.");
                    await setUserState(userId, UserState.start);
                    return;
                }

                if (ctx.message?.document) {
                    // It's a file upload
                    const fileId = ctx.message.document.file_id;
                    const file = await ctx.api.getFile(fileId);
                    
                    if (!file.file_path) {
                        await ctx.reply("❌ Error getting file path.");
                        return;
                    }

                    const response = await fetch(`https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`);
                    const arrayBuffer = await response.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    const result = createFile(dirPath, fileName, buffer);
                    await ctx.reply(result.message);
                } else if (text) {
                    // It's a text message
                    const result = createFile(dirPath, fileName, text);
                    await ctx.reply(result.message);
                } else {
                    await ctx.reply("❌ Please send text or upload a document.");
                    return;
                }

                // Reset state
                await setUserState(userId, UserState.start);

                // Show directory listing
                await fileExplorerMenuHandler(ctx, dirPath);
                break;
            }

            case UserState.file_explorer_edit_file: {
                const filePath = userData.data?.fileExplorerEditPath;
                if (!filePath) {
                    await ctx.reply("❌ Error: file context lost. Please start over.");
                    await setUserState(userId, UserState.start);
                    return;
                }

                if (ctx.message?.document) {
                    const fileId = ctx.message.document.file_id;
                    const file = await ctx.api.getFile(fileId);
                    
                    if (!file.file_path) {
                        await ctx.reply("❌ Error getting file path.");
                        return;
                    }

                    const response = await fetch(`https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`);
                    const arrayBuffer = await response.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    const result = updateFile(filePath, buffer);
                    await ctx.reply(result.message);
                } else if (text) {
                    const result = updateFile(filePath, text);
                    await ctx.reply(result.message);
                } else {
                    await ctx.reply("❌ Please send text or upload a document.");
                    return;
                }

                // Reset state
                await setUserState(userId, UserState.start);

                // Show directory listing
                const dirPathForMenu = path.dirname(filePath);
                await fileExplorerMenuHandler(ctx, dirPathForMenu);
                break;
            }

            default:
                await ctx.reply("❌ Unknown state");
                await setUserState(userId, UserState.start);
                break;
        }
    } catch (error) {
        logger.error(error, { section: "fileExplorerMessageHandler", state });
        await ctx.reply("❌ An error occurred");
    }
};
