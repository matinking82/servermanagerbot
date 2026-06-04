import { execCommand } from "./execCommand";
import logger from "../core/logger";

export interface TmuxSession {
    name: string;
    windows: string;
    created: string;
    attached: boolean;
}

/**
 * Get list of tmux sessions
 */
export const tmuxList = async (): Promise<{ success: boolean; sessions: TmuxSession[]; message?: string }> => {
    try {
        const result = await execCommand("tmux ls -F '#{session_name}|#{session_windows}|#{session_created}|#{session_attached}'");

        if (!result.success) {
            // "no server running" is not really an error
            if (result.error?.includes("no server running") || result.error?.includes("no sessions")) {
                return { success: true, sessions: [] };
            }
            return { success: false, sessions: [], message: result.error || "Failed to get tmux sessions" };
        }

        const sessions: TmuxSession[] = result.output
            .trim()
            .split("\n")
            .filter((line) => line.trim().length > 0)
            .map((line) => {
                const parts = line.split("|");
                return {
                    name: parts[0] || "unknown",
                    windows: parts[1] || "0",
                    created: parts[2] ? new Date(parseInt(parts[2]) * 1000).toLocaleString() : "N/A",
                    attached: parts[3] === "1",
                };
            });

        return { success: true, sessions };
    } catch (error) {
        logger.error(error, { section: "tmuxList" });
        return { success: false, sessions: [], message: "Error fetching tmux sessions" };
    }
};

/**
 * Kill a tmux session by name
 */
export const tmuxKill = async (sessionName: string): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await execCommand(`tmux kill-session -t "${sessionName}"`);
        return {
            success: result.success,
            message: result.success ? `✅ Killed tmux session: ${sessionName}` : `❌ Failed to kill: ${result.error}`,
        };
    } catch (error) {
        logger.error(error, { section: "tmuxKill" });
        return { success: false, message: "Error killing tmux session" };
    }
};
