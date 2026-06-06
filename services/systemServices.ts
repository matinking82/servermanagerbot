import * as os from 'os';
import { execCommand } from "./execCommand";

export const getSystemUsage = async () => {
    // RAM
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramUsage = `${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB (${((usedMem / totalMem) * 100).toFixed(2)}%)`;

    // CPU
    let cpuUsage = "Unknown";
    try {
        const topResult = await execCommand("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'");
        if (topResult.success) {
            cpuUsage = `${topResult.output.trim()}%`;
        } else {
            // Fallback to load average
            const cpus = os.cpus().length;
            const loadavg = os.loadavg()[0];
            cpuUsage = `Load avg: ${loadavg.toFixed(2)} (${cpus} cores)`;
        }
    } catch (e) {
        cpuUsage = "Error getting CPU";
    }

    // Swap
    let swapUsage = "Unknown";
    try {
        const swapRes = await execCommand("free -m | awk '/Swap:/ {print $2, $3}'");
        if (swapRes.success) {
            const parts = swapRes.output.trim().split(/\s+/);
            const totalSwap = parseInt(parts[0], 10) || 0;
            const usedSwap = parseInt(parts[1], 10) || 0;
            if (totalSwap > 0) {
                swapUsage = `${(usedSwap / 1024).toFixed(2)} GB / ${(totalSwap / 1024).toFixed(2)} GB (${((usedSwap / totalSwap) * 100).toFixed(2)}%)`;
            } else {
                swapUsage = "0.00 GB / 0.00 GB (0.00%)";
            }
        }
    } catch (e) {
        swapUsage = "Error getting swap";
    }

    // Storage
    let storageUsage = "Unknown";
    try {
        const diskRes = await execCommand("df -h / | awk 'NR==2 {print $3 \" / \" $2 \" (\" $5 \")\"}'");
        if (diskRes.success) {
            storageUsage = diskRes.output.trim();
        }
    } catch (e) {
        storageUsage = "Error getting storage";
    }

    return {
        success: true,
        cpu: cpuUsage,
        ram: ramUsage,
        swap: swapUsage,
        storage: storageUsage
    };
};
