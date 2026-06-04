import { exec } from "child_process";
import logger from "../core/logger";
import { getCleanEnv } from "../core/env";

/**
 * Execute a shell command and return the output
 */
export const execCommand = (command: string, timeoutMs: number = 30000): Promise<{ success: boolean; output: string; error?: string }> => {
    return new Promise((resolve) => {
        exec(command, { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 10, env: getCleanEnv() }, (error, stdout, stderr) => {
            if (error) {
                logger.error(`Command failed: ${command} - ${error.message}`, { section: "execCommand" });
                resolve({
                    success: false,
                    output: stdout?.toString() || "",
                    error: stderr?.toString() || error.message,
                });
                return;
            }
            resolve({
                success: true,
                output: stdout?.toString() || "",
                error: stderr?.toString() || "",
            });
        });
    });
};
