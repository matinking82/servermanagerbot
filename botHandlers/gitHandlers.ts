import { Context, InlineKeyboard } from "grammy";
import { isAdmin } from "../core/adminCheck";
import { getUserData, setUserData, setUserState } from "../services/userDbServices";
import { UserState } from "../core/enums";
import logger from "../core/logger";
import { isGitRepo, gitInit, gitStatus, gitAddAll, gitAddFiles, gitCommit, gitRestoreFiles, gitLog, gitPush, gitPull, gitBranchList, gitBranchCreate, gitBranchCheckout, gitRemoteList, gitRemoteAdd, gitMerge } from "../services/gitServices";
import { listDirectory } from "../services/fileExplorerServices";
import * as path from "path";

// --- Path Registry for handling long paths ---
const gitPathRegistry = new Map<string, string>();
let gitPathCounter = 0;

function encodePath(p: string): string {
    const b64 = Buffer.from(p).toString('base64url');
    if (b64.length <= 40) return b64;
    const key = 'g' + (gitPathCounter++);
    gitPathRegistry.set(key, p);
    return key;
}

export function decodePath(encoded: string): string {
    if (gitPathRegistry.has(encoded)) return gitPathRegistry.get(encoded)!;
    return Buffer.from(encoded, 'base64url').toString();
}

/**
 * Main menu for Git - shows saved repos
 */
export const gitMenuHandler = async (ctx: Context) => {
    try {
        if (!(await isAdmin(ctx))) return;

        const userId = ctx.from?.id as number;
        const userData = await getUserData(userId);
        const repos: string[] = userData.data?.gitRepos || [];

        let kb = new InlineKeyboard();
        
        if (repos.length > 0) {
            for (const repo of repos) {
                const encoded = encodePath(repo);
                kb.text(`📁 ${path.basename(repo)}`, `git_repo_${encoded}`).row();
            }
        }

        const rootEncoded = encodePath('/root');
        kb.text("➕ Add Repository", `git_explore_${rootEncoded}_0`).row();

        await ctx.reply("🐙 *Git Manager*\n\nSelect a repository or add a new one:", {
            parse_mode: "Markdown",
            reply_markup: kb,
        });
    } catch (error) {
        logger.error(error, { section: "gitMenuHandler" });
    }
};

/**
 * Show actions for a selected repo
 */
const showRepoMenu = async (ctx: Context, repoPath: string) => {
    const encoded = encodePath(repoPath);
    const statusRes = await gitStatus(repoPath);
    
    let text = `🐙 *Repo:* \`${repoPath}\`\n`;
    if (statusRes.success) {
        text += `🌿 *Branch:* \`${statusRes.branch}\`\n`;
        text += `📄 *Changed Files:* ${statusRes.files.length}\n`;
    } else {
        text += `❌ *Error reading status*\n`;
    }

    const kb = new InlineKeyboard()
        .text("📊 Status", `git_status_${encoded}`)
        .text("📜 Log", `git_log_${encoded}`).row()
        .text("➕ Add Files", `git_addFilesStart_${encoded}`)
        .text("📝 Commit", `git_commitStart_${encoded}`).row()
        .text("⬆️ Push", `git_push_${encoded}`)
        .text("⬇️ Pull", `git_pull_${encoded}`).row()
        .text("⏪ Restore", `git_restoreStart_${encoded}`)
        .text("🔀 Branch", `git_branchMenu_${encoded}`).row()
        .text("🔗 Remote", `git_remoteMenu_${encoded}`)
        .text("🗑️ Remove Repo", `git_remove_${encoded}`).row()
        .text("🔙 Back to Repos", `git_backToRepos`);

    if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: kb });
    } else {
        await ctx.reply(text, { parse_mode: "Markdown", reply_markup: kb });
    }
};

export const gitCallbackHandler = async (ctx: Context, action: string, params: string[]) => {
    try {
        if (!(await isAdmin(ctx))) return;
        const userId = ctx.from?.id as number;

        switch (action) {
            case "backToRepos": {
                await ctx.answerCallbackQuery();
                // We could delete the message and call gitMenuHandler, but edit is cleaner
                await ctx.deleteMessage().catch(() => {});
                await gitMenuHandler(ctx);
                break;
            }
            
            // --- File Explorer for Adding Repo ---
            case "explore":
            case "explorePage": {
                const dirPath = decodePath(params[0]);
                const page = params[1] ? parseInt(params[1], 10) : 0;

                const result = listDirectory(dirPath, page);
                if (!result.success) {
                    await ctx.answerCallbackQuery({ text: "❌ Error reading directory" });
                    return;
                }

                const kb = new InlineKeyboard();
                
                // Show directories only
                for (const item of result.items.filter(i => i.isDirectory)) {
                    const fullPath = path.join(result.currentPath, item.name);
                    const encoded = encodePath(fullPath);
                    kb.text(`📁 ${item.name}`, `git_explore_${encoded}_0`).row();
                }

                const navRow: { text: string; data: string }[] = [];
                if (result.currentPath !== "/") {
                    const parentEncoded = encodePath(path.dirname(result.currentPath));
                    navRow.push({ text: "⬆️ Parent", data: `git_explore_${parentEncoded}_0` });
                }
                if (result.totalPages > 1) {
                    const dirEncoded = encodePath(result.currentPath);
                    if (result.currentPage > 0) {
                        navRow.push({ text: "◀️ Prev", data: `git_explorePage_${dirEncoded}_${result.currentPage - 1}` });
                    }
                    if (result.currentPage < result.totalPages - 1) {
                        navRow.push({ text: "▶️ Next", data: `git_explorePage_${dirEncoded}_${result.currentPage + 1}` });
                    }
                }
                if (navRow.length > 0) {
                    for (const btn of navRow) kb.text(btn.text, btn.data);
                    kb.row();
                }

                const currentEncoded = encodePath(result.currentPath);
                kb.text("✅ Select this folder as Repo", `git_addRepo_${currentEncoded}`).row();
                kb.text("❌ Cancel", "git_backToRepos");

                const text = `📂 *Select Repository Folder*\nCurrent: \`${result.currentPath}\``;
                await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: kb });
                await ctx.answerCallbackQuery();
                break;
            }

            case "addRepo": {
                const dirPath = decodePath(params[0]);
                if (!isGitRepo(dirPath)) {
                    const kb = new InlineKeyboard()
                        .text("✨ Initialize Git", `git_initRepo_${params[0]}`).row()
                        .text("❌ Cancel", `git_backToRepos`);
                    await ctx.editMessageText(`⚠️ Directory is not a git repository:\n\`${dirPath}\``, {
                        parse_mode: "Markdown", reply_markup: kb
                    });
                    await ctx.answerCallbackQuery();
                    return;
                }

                // Add to user data
                const userData = await getUserData(userId);
                const data = userData.data || {};
                if (!data.gitRepos) data.gitRepos = [];
                if (!data.gitRepos.includes(dirPath)) {
                    data.gitRepos.push(dirPath);
                    await setUserData(userId, data);
                }

                await ctx.answerCallbackQuery({ text: "✅ Repository added!" });
                await showRepoMenu(ctx, dirPath);
                break;
            }

            case "initRepo": {
                const dirPath = decodePath(params[0]);
                await gitInit(dirPath);
                
                const userData = await getUserData(userId);
                const data = userData.data || {};
                if (!data.gitRepos) data.gitRepos = [];
                if (!data.gitRepos.includes(dirPath)) {
                    data.gitRepos.push(dirPath);
                    await setUserData(userId, data);
                }

                await ctx.answerCallbackQuery({ text: "✨ Git initialized!" });
                await showRepoMenu(ctx, dirPath);
                break;
            }

            // --- Repo Menu Actions ---
            case "repo": {
                const repoPath = decodePath(params[0]);
                await showRepoMenu(ctx, repoPath);
                await ctx.answerCallbackQuery();
                break;
            }

            case "remove": {
                const repoPath = decodePath(params[0]);
                const userData = await getUserData(userId);
                const data = userData.data || {};
                if (data.gitRepos) {
                    data.gitRepos = data.gitRepos.filter((r: string) => r !== repoPath);
                    await setUserData(userId, data);
                }
                await ctx.answerCallbackQuery({ text: "🗑️ Repository removed." });
                await ctx.deleteMessage().catch(() => {});
                await gitMenuHandler(ctx);
                break;
            }

            case "status": {
                const repoPath = decodePath(params[0]);
                const res = await gitStatus(repoPath);
                let text = `📊 *Status for ${path.basename(repoPath)}*\n\n`;
                if (!res.success) {
                    text += `Error: ${res.error}`;
                } else {
                    text += `🌿 Branch: \`${res.branch}\`\n\n`;
                    if (res.files.length === 0) text += "Nothing to commit, working tree clean.";
                    else {
                        res.files.forEach(f => {
                            text += `\`${f.status}\` ${f.file}\n`;
                        });
                    }
                }
                
                const kb = new InlineKeyboard().text("🔙 Back", `git_repo_${params[0]}`);
                await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: kb });
                await ctx.answerCallbackQuery();
                break;
            }

            case "log": {
                const repoPath = decodePath(params[0]);
                const res = await gitLog(repoPath, 15);
                let text = `📜 *Git Log*\n\n\`\`\`\n${res.success ? (res.output || 'No commits yet.') : res.error}\n\`\`\``;
                const kb = new InlineKeyboard().text("🔙 Back", `git_repo_${params[0]}`);
                await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: kb });
                await ctx.answerCallbackQuery();
                break;
            }

            case "push": {
                const repoPath = decodePath(params[0]);
                await ctx.answerCallbackQuery({ text: "Pushing..." });
                const res = await gitPush(repoPath);
                let text = `⬆️ *Git Push*\n\n\`\`\`\n${res.success ? (res.output + (res.error ? '\n' + res.error : '')) : res.error}\n\`\`\``;
                const kb = new InlineKeyboard().text("🔙 Back", `git_repo_${params[0]}`);
                await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: kb });
                break;
            }

            case "pull": {
                const repoPath = decodePath(params[0]);
                await ctx.answerCallbackQuery({ text: "Pulling..." });
                const res = await gitPull(repoPath);
                let text = `⬇️ *Git Pull*\n\n\`\`\`\n${res.success ? (res.output + (res.error ? '\n' + res.error : '')) : res.error}\n\`\`\``;
                const kb = new InlineKeyboard().text("🔙 Back", `git_repo_${params[0]}`);
                await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: kb });
                break;
            }

            // --- Commit ---
            case "commitStart": {
                const repoPath = decodePath(params[0]);
                const userData = await getUserData(userId);
                const data = userData.data || {};
                data.gitActiveRepo = repoPath;
                await setUserData(userId, data);
                await setUserState(userId, UserState.git_commit_msg);

                await ctx.reply("📝 Please enter your commit message:\n\n(Type /cancel to abort)");
                await ctx.answerCallbackQuery();
                break;
            }

            // --- File Selector (Add/Restore) ---
            case "addFilesStart":
            case "restoreFilesStart": {
                const isAdd = action === "addFilesStart";
                const repoPath = decodePath(params[0]);
                const statusRes = await gitStatus(repoPath);
                
                if (!statusRes.success) {
                    await ctx.answerCallbackQuery({ text: "❌ Error reading git status" });
                    return;
                }

                if (statusRes.files.length === 0) {
                    await ctx.answerCallbackQuery({ text: "No changed files." });
                    return;
                }

                const userData = await getUserData(userId);
                const data = userData.data || {};
                data.gitSelectedFiles = []; // Clear selection
                data.gitActiveRepo = repoPath;
                await setUserData(userId, data);

                const kb = new InlineKeyboard();
                for (let i = 0; i < statusRes.files.length; i++) {
                    const f = statusRes.files[i];
                    kb.text(`❌ [${f.status}] ${f.file}`, `git_toggleFile_${isAdd ? 'add' : 'res'}_${i}`).row();
                }
                
                kb.text("✅ Done", `git_filesDone_${isAdd ? 'add' : 'res'}`)
                  .text("🔙 Cancel", `git_repo_${params[0]}`).row();
                  
                const text = `📂 *Select files to ${isAdd ? 'add' : 'restore'}*`;
                await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: kb });
                await ctx.answerCallbackQuery();
                break;
            }

            case "toggleFile": {
                const mode = params[0]; // add or res
                const fileIndex = parseInt(params[1]);
                
                const userData = await getUserData(userId);
                const data = userData.data || {};
                if (!data.gitSelectedFiles) data.gitSelectedFiles = [];
                
                // toggle
                if (data.gitSelectedFiles.includes(fileIndex)) {
                    data.gitSelectedFiles = data.gitSelectedFiles.filter((id: number) => id !== fileIndex);
                } else {
                    data.gitSelectedFiles.push(fileIndex);
                }
                await setUserData(userId, data);
                
                // Re-render keyboard
                const repoPath = data.gitActiveRepo;
                const encodedRepo = encodePath(repoPath);
                const statusRes = await gitStatus(repoPath);
                
                if (!statusRes.success) {
                    await ctx.answerCallbackQuery({ text: "❌ Error" });
                    return;
                }

                const kb = new InlineKeyboard();
                for (let i = 0; i < statusRes.files.length; i++) {
                    const f = statusRes.files[i];
                    const isSel = data.gitSelectedFiles.includes(i);
                    kb.text(`${isSel ? '✅' : '❌'} [${f.status}] ${f.file}`, `git_toggleFile_${mode}_${i}`).row();
                }
                
                kb.text("✅ Done", `git_filesDone_${mode}`)
                  .text("🔙 Cancel", `git_repo_${encodedRepo}`).row();
                  
                await ctx.editMessageReplyMarkup({ reply_markup: kb });
                await ctx.answerCallbackQuery();
                break;
            }

            case "filesDone": {
                const mode = params[0]; // add or res
                const userData = await getUserData(userId);
                const data = userData.data || {};
                const repoPath = data.gitActiveRepo;
                const encodedRepo = encodePath(repoPath);
                
                if (!data.gitSelectedFiles || data.gitSelectedFiles.length === 0) {
                    await ctx.answerCallbackQuery({ text: "No files selected." });
                    return;
                }

                const statusRes = await gitStatus(repoPath);
                const filesToProcess = data.gitSelectedFiles.map((idx: number) => statusRes.files[idx]?.file).filter(Boolean);
                
                await ctx.answerCallbackQuery({ text: "Processing..." });
                
                if (mode === 'add') {
                    await gitAddFiles(repoPath, filesToProcess);
                } else {
                    await gitRestoreFiles(repoPath, filesToProcess);
                }
                
                // clear selection
                data.gitSelectedFiles = [];
                await setUserData(userId, data);
                
                await showRepoMenu(ctx, repoPath);
                break;
            }
            
            // --- Branch Menu ---
            case "branchMenu": {
                const repoPath = decodePath(params[0]);
                const res = await gitBranchList(repoPath);
                let text = `🔀 *Branches*\n\n\`\`\`\n${res.success ? res.output : res.error}\n\`\`\``;
                
                const kb = new InlineKeyboard()
                    .text("➕ New Branch", `git_branchNew_${params[0]}`).row()
                    .text("🔙 Back", `git_repo_${params[0]}`);
                    
                await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: kb });
                await ctx.answerCallbackQuery();
                break;
            }
            
            case "branchNew": {
                const repoPath = decodePath(params[0]);
                const userData = await getUserData(userId);
                const data = userData.data || {};
                data.gitActiveRepo = repoPath;
                await setUserData(userId, data);
                await setUserState(userId, UserState.git_branch_name);

                await ctx.reply("🔀 Enter new branch name:\n\n(Type /cancel to abort)");
                await ctx.answerCallbackQuery();
                break;
            }
            
            // --- Remote Menu ---
            case "remoteMenu": {
                const repoPath = decodePath(params[0]);
                const res = await gitRemoteList(repoPath);
                let text = `🔗 *Remotes*\n\n\`\`\`\n${res.success ? (res.output || 'No remotes.') : res.error}\n\`\`\``;
                
                const kb = new InlineKeyboard()
                    .text("🔙 Back", `git_repo_${params[0]}`);
                    
                await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: kb });
                await ctx.answerCallbackQuery();
                break;
            }

            default:
                await ctx.answerCallbackQuery({ text: "❌ Unknown action" });
                break;
        }
    } catch (error) {
        logger.error(error, { section: "gitCallbackHandler", action, params });
        try { await ctx.answerCallbackQuery({ text: "❌ Error" }); } catch {}
    }
};

export const gitMessageHandler = async (ctx: Context, state: string) => {
    try {
        if (!(await isAdmin(ctx))) return;

        const userId = ctx.from?.id as number;
        const text = ctx.message?.text?.trim();

        if (!text) {
            await ctx.reply("❌ Invalid input");
            return;
        }

        const userData = await getUserData(userId);
        const data = userData.data || {};
        const repoPath = data.gitActiveRepo;

        if (!repoPath) {
            await ctx.reply("❌ Repo context lost. Please try again.");
            await setUserState(userId, UserState.start);
            return;
        }

        switch (state) {
            case UserState.git_commit_msg: {
                const res = await gitCommit(repoPath, text);
                await ctx.reply(`📝 *Commit*\n\`\`\`\n${res.success ? res.output : res.error}\n\`\`\``, { parse_mode: "Markdown" });
                await setUserState(userId, UserState.start);
                await showRepoMenu(ctx, repoPath);
                break;
            }
            case UserState.git_branch_name: {
                const res = await gitBranchCreate(repoPath, text);
                await ctx.reply(`🔀 *Create Branch*\n\`\`\`\n${res.success ? res.output : res.error}\n\`\`\``, { parse_mode: "Markdown" });
                await setUserState(userId, UserState.start);
                await showRepoMenu(ctx, repoPath);
                break;
            }
            default:
                await ctx.reply("❌ Unknown state");
                await setUserState(userId, UserState.start);
                break;
        }
    } catch (error) {
        logger.error(error, { section: "gitMessageHandler", state });
        await ctx.reply("❌ An error occurred");
    }
};
