import { execCommand } from "./execCommand";
import logger from "../core/logger";

const getAuthString = () => {
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD;
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT;
    return `-u ${user}${password ? ` -p${password}` : ''}${host ? ` -h ${host}` : ''}${port ? ` -P ${port}` : ''}`;
};

/**
 * Get list of MySQL databases
 */
export const mysqlListDatabases = async (): Promise<{ success: boolean; databases: string[]; message?: string }> => {
    try {
        const result = await execCommand(`mysql ${getAuthString()} -e "SHOW DATABASES;" -s -N`);
        if (!result.success) {
            return { success: false, databases: [], message: result.error || "Failed to list databases" };
        }

        const databases = result.output
            .trim()
            .split("\n")
            .filter((db) => db.trim().length > 0);

        return { success: true, databases };
    } catch (error) {
        logger.error(error, { section: "mysqlListDatabases" });
        return { success: false, databases: [], message: "Error listing databases" };
    }
};

/**
 * Create a MySQL database
 */
export const mysqlCreateDatabase = async (dbName: string): Promise<{ success: boolean; message: string }> => {
    try {
        // Sanitize database name
        const safeName = dbName.replace(/[^a-zA-Z0-9_]/g, "");
        if (safeName.length === 0) {
            return { success: false, message: "❌ Invalid database name" };
        }

        const result = await execCommand(`mysql ${getAuthString()} -e "CREATE DATABASE \\\`${safeName}\\\`;"`);
        return {
            success: result.success,
            message: result.success ? `✅ Database '${safeName}' created successfully` : `❌ Failed: ${result.error}`,
        };
    } catch (error) {
        logger.error(error, { section: "mysqlCreateDatabase" });
        return { success: false, message: "Error creating database" };
    }
};

/**
 * Get list of tables in a database
 */
export const mysqlListTables = async (dbName: string): Promise<{ success: boolean; tables: string[]; message?: string }> => {
    try {
        const safeName = dbName.replace(/[^a-zA-Z0-9_]/g, "");
        const result = await execCommand(`mysql ${getAuthString()} -e "USE \\\`${safeName}\\\`; SHOW TABLES;" -s -N`);
        if (!result.success) {
            return { success: false, tables: [], message: result.error || "Failed to list tables" };
        }

        const tables = result.output
            .trim()
            .split("\n")
            .filter((t) => t.trim().length > 0);

        return { success: true, tables };
    } catch (error) {
        logger.error(error, { section: "mysqlListTables" });
        return { success: false, tables: [], message: "Error listing tables" };
    }
};

/**
 * Run a MySQL query on a database
 */
export const mysqlRunQuery = async (dbName: string, query: string): Promise<{ success: boolean; output: string; message?: string }> => {
    try {
        const safeName = dbName.replace(/[^a-zA-Z0-9_]/g, "");
        // Escape the query for shell
        const escapedQuery = query.replace(/"/g, '\\"');
        const result = await execCommand(`mysql ${getAuthString()} -e "USE \\\`${safeName}\\\`; ${escapedQuery}" 2>&1`, 60000);

        return {
            success: result.success,
            output: result.output || result.error || "No output",
            message: result.success ? undefined : result.error,
        };
    } catch (error) {
        logger.error(error, { section: "mysqlRunQuery" });
        return { success: false, output: "", message: "Error running query" };
    }
};

/**
 * Get last N rows from a table
 */
export const mysqlGetLastRows = async (
    dbName: string,
    tableName: string,
    limit: number = 20
): Promise<{ success: boolean; output: string; message?: string }> => {
    try {
        const safeName = dbName.replace(/[^a-zA-Z0-9_]/g, "");
        const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, "");
        const result = await execCommand(
            `mysql ${getAuthString()} -e "USE \\\`${safeName}\\\`; SELECT * FROM \\\`${safeTable}\\\` ORDER BY 1 DESC LIMIT ${limit};" 2>&1`
        );

        return {
            success: result.success,
            output: result.output || result.error || "No data",
            message: result.success ? undefined : result.error,
        };
    } catch (error) {
        logger.error(error, { section: "mysqlGetLastRows" });
        return { success: false, output: "", message: "Error fetching rows" };
    }
};

/**
 * Get table details (structure)
 */
export const mysqlTableDetails = async (
    dbName: string,
    tableName: string
): Promise<{ success: boolean; output: string; message?: string }> => {
    try {
        const safeName = dbName.replace(/[^a-zA-Z0-9_]/g, "");
        const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, "");
        const result = await execCommand(
            `mysql ${getAuthString()} -e "USE \\\`${safeName}\\\`; DESCRIBE \\\`${safeTable}\\\`;" 2>&1`
        );

        return {
            success: result.success,
            output: result.output || result.error || "No details available",
            message: result.success ? undefined : result.error,
        };
    } catch (error) {
        logger.error(error, { section: "mysqlTableDetails" });
        return { success: false, output: "", message: "Error fetching table details" };
    }
};
