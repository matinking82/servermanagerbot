import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import logger from "../core/logger";

interface BashSession {
    process: ChildProcessWithoutNullStreams;
    outputBuffer: string;
    lastActivity: number;
}

// Map of userId -> bash session
const activeSessions = new Map<number, BashSession>();

// Session timeout in ms (10 minutes of inactivity)
const SESSION_TIMEOUT = 10 * 60 * 1000;

/**
 * Create a new interactive bash session for a user
 */
export const createBashSession = (userId: number): { success: boolean; message: string } => {
    try {
        // Kill existing session if any
        destroyBashSession(userId);

        const proc = spawn("bash", ["-i"], {
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, TERM: "dumb", PS1: "$ " },
        });

        const session: BashSession = {
            process: proc,
            outputBuffer: "",
            lastActivity: Date.now(),
        };

        proc.stdout.on("data", (data: Buffer) => {
            session.outputBuffer += data.toString();
            session.lastActivity = Date.now();
        });

        proc.stderr.on("data", (data: Buffer) => {
            session.outputBuffer += data.toString();
            session.lastActivity = Date.now();
        });

        proc.on("close", () => {
            activeSessions.delete(userId);
        });

        proc.on("error", (err) => {
            logger.error(`Bash session error for user ${userId}: ${err.message}`, { section: "bashSession" });
            activeSessions.delete(userId);
        });

        activeSessions.set(userId, session);

        return { success: true, message: "🖥️ Bash session started.\n\nSend commands and I'll execute them.\nSend `exit` to end the session." };
    } catch (error) {
        logger.error(error, { section: "createBashSession" });
        return { success: false, message: "Error creating bash session" };
    }
};

/**
 * Send a command to an existing bash session
 */
export const sendBashCommand = async (userId: number, command: string): Promise<{ success: boolean; output: string; closed?: boolean }> => {
    try {
        const session = activeSessions.get(userId);

        if (!session || session.process.killed) {
            return { success: false, output: "No active bash session. Session may have timed out.", closed: true };
        }

        // Clear the buffer before sending
        session.outputBuffer = "";
        session.lastActivity = Date.now();

        // Write the command
        session.process.stdin.write(command + "\n");

        // Wait for output to settle
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Check if more output is still coming
        let prevLen = -1;
        let attempts = 0;
        while (prevLen !== session.outputBuffer.length && attempts < 10) {
            prevLen = session.outputBuffer.length;
            await new Promise((resolve) => setTimeout(resolve, 500));
            attempts++;
        }

        const output = session.outputBuffer || "(no output)";
        session.outputBuffer = "";

        return { success: true, output };
    } catch (error) {
        logger.error(error, { section: "sendBashCommand" });
        return { success: false, output: "Error sending command" };
    }
};

/**
 * Destroy a bash session
 */
export const destroyBashSession = (userId: number): void => {
    const session = activeSessions.get(userId);
    if (session) {
        try {
            session.process.stdin.end();
            session.process.kill("SIGTERM");
        } catch (e) {
            // ignore
        }
        activeSessions.delete(userId);
    }
};

/**
 * Check if a user has an active bash session
 */
export const hasBashSession = (userId: number): boolean => {
    const session = activeSessions.get(userId);
    if (!session) return false;

    // Check timeout
    if (Date.now() - session.lastActivity > SESSION_TIMEOUT) {
        destroyBashSession(userId);
        return false;
    }

    return !session.process.killed;
};

// Periodic cleanup of timed-out sessions
setInterval(() => {
    for (const [userId, session] of activeSessions.entries()) {
        if (Date.now() - session.lastActivity > SESSION_TIMEOUT) {
            logger.info(`Cleaning up timed-out bash session for user ${userId}`, { section: "bashSessionCleanup" });
            destroyBashSession(userId);
        }
    }
}, 60000);
