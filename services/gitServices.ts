import * as fs from "fs";
import * as path from "path";
import { execCommand } from "./execCommand";
import logger from "../core/logger";

export const isGitRepo = (dirPath: string): boolean => {
    return fs.existsSync(path.join(dirPath, '.git'));
};

export const gitInit = async (dirPath: string) => {
    return await execCommand(`cd ${dirPath} && git init`);
};

export interface GitFileStatus {
    status: string;
    file: string;
}

export const gitStatus = async (dirPath: string) => {
    const branchRes = await execCommand(`cd ${dirPath} && git branch --show-current`);
    const branch = branchRes.success ? branchRes.output.trim() : "unknown";

    const statusRes = await execCommand(`cd ${dirPath} && git status --porcelain`);
    const files: GitFileStatus[] = [];
    
    if (statusRes.success && statusRes.output.trim() !== "") {
        const lines = statusRes.output.split('\n').filter(l => l.trim() !== "");
        for (const line of lines) {
            // --porcelain outputs "XY filename"
            const status = line.substring(0, 2);
            let file = line.substring(3).trim();
            // Handle quotes in filename
            if (file.startsWith('"') && file.endsWith('"')) {
                file = file.slice(1, -1);
            }
            files.push({ status, file });
        }
    }

    return { success: statusRes.success, branch, files, error: statusRes.error };
};

export const gitAddAll = async (dirPath: string) => {
    return await execCommand(`cd ${dirPath} && git add .`);
}

export const gitAddFiles = async (dirPath: string, files: string[]) => {
    if (files.length === 0) return { success: true, output: "" };
    // Escape filenames
    const filesStr = files.map(f => `"${f}"`).join(" ");
    return await execCommand(`cd ${dirPath} && git add ${filesStr}`);
};

export const gitCommit = async (dirPath: string, message: string) => {
    const escapedMsg = message.replace(/"/g, '\\"');
    return await execCommand(`cd ${dirPath} && git commit -m "${escapedMsg}"`);
};

export const gitRestoreFiles = async (dirPath: string, files: string[]) => {
    if (files.length === 0) return { success: true, output: "" };
    const filesStr = files.map(f => `"${f}"`).join(" ");
    return await execCommand(`cd ${dirPath} && git restore --staged ${filesStr} && git restore ${filesStr}`);
};

export const gitLog = async (dirPath: string, count: number = 10) => {
    return await execCommand(`cd ${dirPath} && git log -n ${count} --oneline`);
};

export const gitPush = async (dirPath: string) => {
    return await execCommand(`cd ${dirPath} && git push`);
};

export const gitPull = async (dirPath: string) => {
    return await execCommand(`cd ${dirPath} && git pull`);
};

export const gitBranchList = async (dirPath: string) => {
    return await execCommand(`cd ${dirPath} && git branch -a`);
};

export const gitBranchCreate = async (dirPath: string, name: string) => {
    return await execCommand(`cd ${dirPath} && git checkout -b ${name}`);
};

export const gitBranchCheckout = async (dirPath: string, name: string) => {
    return await execCommand(`cd ${dirPath} && git checkout ${name}`);
};

export const gitRemoteList = async (dirPath: string) => {
    return await execCommand(`cd ${dirPath} && git remote -v`);
};

export const gitRemoteAdd = async (dirPath: string, name: string, url: string) => {
    return await execCommand(`cd ${dirPath} && git remote add ${name} ${url}`);
};

export const gitMerge = async (dirPath: string, branch: string) => {
    return await execCommand(`cd ${dirPath} && git merge ${branch}`);
};
