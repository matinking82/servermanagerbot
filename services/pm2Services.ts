import { execCommand } from "./execCommand";
import logger from "../core/logger";

export interface PM2Process {
    name: string;
    id: number;
    status: string;
    cpu: string;
    memory: string;
    uptime: string;
}

/**
 * Get list of PM2 processes
 */
export const pm2List = async (): Promise<{ success: boolean; processes: PM2Process[]; message?: string }> => {
    try {
        const result = await execCommand("pm2 jlist");
        if (!result.success) {
            return { success: false, processes: [], message: result.error || "Failed to get PM2 list" };
        }

        const parsed = JSON.parse(result.output);
        const processes: PM2Process[] = parsed.map((p: any) => ({
            name: p.name,
            id: p.pm_id,
            status: p.pm2_env?.status || "unknown",
            cpu: `${p.monit?.cpu || 0}%`,
            memory: `${((p.monit?.memory || 0) / 1024 / 1024).toFixed(1)}MB`,
            uptime: p.pm2_env?.pm_uptime ? formatUptime(Date.now() - p.pm2_env.pm_uptime) : "N/A",
        }));

        return { success: true, processes };
    } catch (error) {
        logger.error(error, { section: "pm2List" });
        return { success: false, processes: [], message: "Error fetching PM2 processes" };
    }
};

/**
 * Start a PM2 process by name/id
 */
export const pm2Start = async (nameOrId: string): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await execCommand(`pm2 start ${nameOrId}`);
        return {
            success: result.success,
            message: result.success ? `✅ Started ${nameOrId}` : `❌ Failed to start: ${result.error}`,
        };
    } catch (error) {
        logger.error(error, { section: "pm2Start" });
        return { success: false, message: "Error starting process" };
    }
};

/**
 * Stop a PM2 process by name/id
 */
export const pm2Stop = async (nameOrId: string): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await execCommand(`pm2 stop ${nameOrId}`);
        return {
            success: result.success,
            message: result.success ? `✅ Stopped ${nameOrId}` : `❌ Failed to stop: ${result.error}`,
        };
    } catch (error) {
        logger.error(error, { section: "pm2Stop" });
        return { success: false, message: "Error stopping process" };
    }
};

/**
 * Restart a PM2 process by name/id
 */
export const pm2Restart = async (nameOrId: string): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await execCommand(`pm2 restart ${nameOrId}`);
        return {
            success: result.success,
            message: result.success ? `✅ Restarted ${nameOrId}` : `❌ Failed to restart: ${result.error}`,
        };
    } catch (error) {
        logger.error(error, { section: "pm2Restart" });
        return { success: false, message: "Error restarting process" };
    }
};

/**
 * Delete a PM2 process by name/id
 */
export const pm2Delete = async (nameOrId: string): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await execCommand(`pm2 delete ${nameOrId}`);
        return {
            success: result.success,
            message: result.success ? `✅ Deleted ${nameOrId}` : `❌ Failed to delete: ${result.error}`,
        };
    } catch (error) {
        logger.error(error, { section: "pm2Delete" });
        return { success: false, message: "Error deleting process" };
    }
};

/**
 * Get PM2 logs for a process (last N lines)
 */
export const pm2Logs = async (nameOrId: string, lines: number = 20): Promise<{ success: boolean; output: string; message?: string }> => {
    try {
        const result = await execCommand(`pm2 logs ${nameOrId} --nostream --lines ${lines}`);
        return {
            success: result.success,
            output: result.output || result.error || "No logs available",
            message: result.success ? undefined : result.error,
        };
    } catch (error) {
        logger.error(error, { section: "pm2Logs" });
        return { success: false, output: "", message: "Error fetching logs" };
    }
};

function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}
