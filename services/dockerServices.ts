import { execCommand } from "./execCommand";
import logger from "../core/logger";

export interface DockerContainer {
    id: string;
    name: string;
    image: string;
    status: string;
    ports: string;
    created: string;
}

/**
 * Get list of running Docker containers
 */
export const dockerList = async (): Promise<{ success: boolean; containers: DockerContainer[]; message?: string }> => {
    try {
        const result = await execCommand(
            `docker ps --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}'`
        );

        if (!result.success) {
            return { success: false, containers: [], message: result.error || "Failed to get Docker containers" };
        }

        const containers: DockerContainer[] = result.output
            .trim()
            .split("\n")
            .filter((line) => line.trim().length > 0)
            .map((line) => {
                const parts = line.split("|");
                return {
                    id: parts[0] || "",
                    name: parts[1] || "unknown",
                    image: parts[2] || "",
                    status: parts[3] || "",
                    ports: parts[4] || "none",
                    created: parts[5] || "",
                };
            });

        return { success: true, containers };
    } catch (error) {
        logger.error(error, { section: "dockerList" });
        return { success: false, containers: [], message: "Error fetching Docker containers" };
    }
};

/**
 * Stop a Docker container by name/id
 */
export const dockerStop = async (nameOrId: string): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await execCommand(`docker stop ${nameOrId}`);
        return {
            success: result.success,
            message: result.success ? `✅ Stopped container: ${nameOrId}` : `❌ Failed to stop: ${result.error}`,
        };
    } catch (error) {
        logger.error(error, { section: "dockerStop" });
        return { success: false, message: "Error stopping container" };
    }
};

/**
 * Restart a Docker container by name/id
 */
export const dockerRestart = async (nameOrId: string): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await execCommand(`docker restart ${nameOrId}`);
        return {
            success: result.success,
            message: result.success ? `✅ Restarted container: ${nameOrId}` : `❌ Failed to restart: ${result.error}`,
        };
    } catch (error) {
        logger.error(error, { section: "dockerRestart" });
        return { success: false, message: "Error restarting container" };
    }
};
