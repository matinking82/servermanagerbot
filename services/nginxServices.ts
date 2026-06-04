import { execCommand } from "./execCommand";
import logger from "../core/logger";
import * as fs from "fs";
import * as path from "path";

const SITES_ENABLED = "/etc/nginx/sites-enabled";

export interface NginxSite {
    filename: string;
    listenPort: string | null;
    serverName: string | null;
    proxyPass: string | null;
    root: string | null;
}

/**
 * Get list of nginx site configs from sites-enabled
 */
export const nginxList = async (): Promise<{ success: boolean; sites: NginxSite[]; message?: string }> => {
    try {
        const files = fs.readdirSync(SITES_ENABLED);
        const sites: NginxSite[] = [];

        for (const filename of files) {
            try {
                const filepath = path.join(SITES_ENABLED, filename);
                const stat = fs.statSync(filepath);
                if (stat.isDirectory()) continue;

                const content = fs.readFileSync(filepath, "utf-8");

                // Parse listen port
                const listenMatch = content.match(/listen\s+(\d+)/);
                const listenPort = listenMatch ? listenMatch[1] : null;

                // Parse server_name
                const serverNameMatch = content.match(/server_name\s+([^;]+)/);
                let serverName = serverNameMatch ? serverNameMatch[1].trim() : null;
                if (serverName === "_") serverName = null;

                // Parse proxy_pass
                const proxyPassMatch = content.match(/proxy_pass\s+([^;]+)/);
                const proxyPass = proxyPassMatch ? proxyPassMatch[1].trim() : null;

                // Parse root
                const rootMatch = content.match(/root\s+([^;]+)/);
                const root = rootMatch ? rootMatch[1].trim() : null;

                sites.push({ filename, listenPort, serverName, proxyPass, root });
            } catch (err) {
                logger.error(`Error parsing ${filename}: ${err}`, { section: "nginxList" });
            }
        }

        return { success: true, sites };
    } catch (error) {
        logger.error(error, { section: "nginxList" });
        return { success: false, sites: [], message: "Error reading nginx sites" };
    }
};

/**
 * Delete an nginx site config
 */
export const nginxDelete = async (filename: string): Promise<{ success: boolean; message: string }> => {
    try {
        // Sanitize filename to prevent path traversal
        const safeName = path.basename(filename);
        const filepath = path.join(SITES_ENABLED, safeName);

        if (!fs.existsSync(filepath)) {
            return { success: false, message: `❌ File not found: ${safeName}` };
        }

        fs.unlinkSync(filepath);
        return { success: true, message: `✅ Deleted: ${safeName}` };
    } catch (error) {
        logger.error(error, { section: "nginxDelete" });
        return { success: false, message: "Error deleting nginx config" };
    }
};

/**
 * Reload nginx
 */
export const nginxReload = async (): Promise<{ success: boolean; message: string }> => {
    try {
        // Test config first
        const testResult = await execCommand("nginx -t 2>&1");
        if (!testResult.success && !testResult.output.includes("successful")) {
            return {
                success: false,
                message: `❌ Nginx config test failed:\n${testResult.error || testResult.output}`,
            };
        }

        const result = await execCommand("systemctl reload nginx");
        return {
            success: result.success,
            message: result.success ? "✅ Nginx reloaded successfully" : `❌ Failed to reload: ${result.error}`,
        };
    } catch (error) {
        logger.error(error, { section: "nginxReload" });
        return { success: false, message: "Error reloading nginx" };
    }
};

/**
 * Create a port-to-URL proxy config
 */
export const nginxCreatePortToUrl = async (port: string, targetUrl: string): Promise<{ success: boolean; message: string }> => {
    try {
        const safeName = `port_${port}_proxy`;
        const config = `server {
    listen ${port};
    server_name _;

    location / {
        proxy_pass ${targetUrl};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
        fs.writeFileSync(path.join(SITES_ENABLED, safeName), config);
        return { success: true, message: `✅ Created nginx config: ${safeName}\n\n⚠️ Remember to reload nginx to apply changes.` };
    } catch (error) {
        logger.error(error, { section: "nginxCreatePortToUrl" });
        return { success: false, message: "Error creating nginx config" };
    }
};

/**
 * Create a port-to-folder static file config
 */
export const nginxCreatePortToFolder = async (port: string, folderPath: string): Promise<{ success: boolean; message: string }> => {
    try {
        const safeName = `port_${port}_static`;
        const config = `server {
    listen ${port};
    server_name _;

    root ${folderPath};
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }
}
`;
        fs.writeFileSync(path.join(SITES_ENABLED, safeName), config);
        return { success: true, message: `✅ Created nginx config: ${safeName}\n\n⚠️ Remember to reload nginx to apply changes.` };
    } catch (error) {
        logger.error(error, { section: "nginxCreatePortToFolder" });
        return { success: false, message: "Error creating nginx config" };
    }
};

/**
 * Create a domain-to-URL proxy config
 */
export const nginxCreateDomainToUrl = async (domain: string, targetUrl: string): Promise<{ success: boolean; message: string }> => {
    try {
        const safeName = domain.replace(/[^a-zA-Z0-9.-]/g, "_");
        const config = `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass ${targetUrl};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
        fs.writeFileSync(path.join(SITES_ENABLED, safeName), config);
        return { success: true, message: `✅ Created nginx config: ${safeName}\n\n⚠️ Remember to reload nginx to apply changes.` };
    } catch (error) {
        logger.error(error, { section: "nginxCreateDomainToUrl" });
        return { success: false, message: "Error creating nginx config" };
    }
};

/**
 * Create a domain-to-folder static file config
 */
export const nginxCreateDomainToFolder = async (domain: string, folderPath: string): Promise<{ success: boolean; message: string }> => {
    try {
        const safeName = domain.replace(/[^a-zA-Z0-9.-]/g, "_");
        const config = `server {
    listen 80;
    server_name ${domain};

    root ${folderPath};
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }
}
`;
        fs.writeFileSync(path.join(SITES_ENABLED, safeName), config);
        return { success: true, message: `✅ Created nginx config: ${safeName}\n\n⚠️ Remember to reload nginx to apply changes.` };
    } catch (error) {
        logger.error(error, { section: "nginxCreateDomainToFolder" });
        return { success: false, message: "Error creating nginx config" };
    }
};
