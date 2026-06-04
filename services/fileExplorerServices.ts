import * as fs from "fs";
import * as path from "path";
import logger from "../core/logger";

export interface FileItem {
    name: string;
    isDirectory: boolean;
    size: number;
    modified: string;
}

const ITEMS_PER_PAGE = 20;

/**
 * List files and folders in a directory with pagination
 */
export const listDirectory = (dirPath: string, page: number = 0): {
    success: boolean;
    items: FileItem[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
    currentPath: string;
    message?: string;
} => {
    try {
        // Normalize and resolve path
        const resolvedPath = path.resolve(dirPath);

        if (!fs.existsSync(resolvedPath)) {
            return {
                success: false,
                items: [],
                totalItems: 0,
                totalPages: 0,
                currentPage: 0,
                currentPath: resolvedPath,
                message: "❌ Directory not found",
            };
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isDirectory()) {
            return {
                success: false,
                items: [],
                totalItems: 0,
                totalPages: 0,
                currentPage: 0,
                currentPath: resolvedPath,
                message: "❌ Not a directory",
            };
        }

        const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });

        const allItems: FileItem[] = entries
            .map((entry) => {
                try {
                    const fullPath = path.join(resolvedPath, entry.name);
                    const fileStat = fs.statSync(fullPath);
                    return {
                        name: entry.name,
                        isDirectory: entry.isDirectory(),
                        size: fileStat.size,
                        modified: fileStat.mtime.toLocaleString(),
                    };
                } catch {
                    return {
                        name: entry.name,
                        isDirectory: entry.isDirectory(),
                        size: 0,
                        modified: "N/A",
                    };
                }
            })
            .sort((a, b) => {
                // Directories first, then alphabetical
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });

        const totalItems = allItems.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
        const currentPage = Math.min(Math.max(0, page), totalPages - 1);
        const start = currentPage * ITEMS_PER_PAGE;
        const items = allItems.slice(start, start + ITEMS_PER_PAGE);

        return {
            success: true,
            items,
            totalItems,
            totalPages,
            currentPage,
            currentPath: resolvedPath,
        };
    } catch (error) {
        logger.error(error, { section: "listDirectory" });
        return {
            success: false,
            items: [],
            totalItems: 0,
            totalPages: 0,
            currentPage: 0,
            currentPath: dirPath,
            message: "Error listing directory",
        };
    }
};

/**
 * Create a new folder
 */
export const createFolder = (dirPath: string, folderName: string): { success: boolean; message: string } => {
    try {
        const safeName = folderName.replace(/[/\\]/g, "");
        if (safeName.length === 0) {
            return { success: false, message: "❌ Invalid folder name" };
        }

        const fullPath = path.join(dirPath, safeName);

        if (fs.existsSync(fullPath)) {
            return { success: false, message: "❌ Folder already exists" };
        }

        fs.mkdirSync(fullPath, { recursive: true });
        return { success: true, message: `✅ Created folder: ${safeName}` };
    } catch (error) {
        logger.error(error, { section: "createFolder" });
        return { success: false, message: "Error creating folder" };
    }
};

/**
 * Create a new file
 */
export const createFile = (dirPath: string, fileName: string, content: string | Buffer = ""): { success: boolean; message: string } => {
    try {
        const safeName = fileName.replace(/[/\\]/g, "");
        if (safeName.length === 0) {
            return { success: false, message: "❌ Invalid file name" };
        }

        const fullPath = path.join(dirPath, safeName);

        if (fs.existsSync(fullPath)) {
            return { success: false, message: "❌ File already exists" };
        }

        fs.writeFileSync(fullPath, content);
        return { success: true, message: `✅ Created file: ${safeName}` };
    } catch (error) {
        logger.error(error, { section: "createFile" });
        return { success: false, message: "Error creating file" };
    }
};

/**
 * Delete a file or empty folder
 */
export const deleteItem = (itemPath: string): { success: boolean; message: string } => {
    try {
        if (!fs.existsSync(itemPath)) {
            return { success: false, message: "❌ Item not found" };
        }

        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
            fs.rmdirSync(itemPath, { recursive: true } as any);
        } else {
            fs.unlinkSync(itemPath);
        }

        return { success: true, message: `✅ Deleted: ${path.basename(itemPath)}` };
    } catch (error) {
        logger.error(error, { section: "deleteItem" });
        return { success: false, message: "Error deleting item" };
    }
};

/**
 * Get file info (for sending)
 */
export const getFileInfo = (filePath: string): {
    success: boolean;
    exists: boolean;
    isFile: boolean;
    size: number;
    name: string;
    path: string;
    message?: string;
} => {
    try {
        if (!fs.existsSync(filePath)) {
            return { success: false, exists: false, isFile: false, size: 0, name: "", path: filePath };
        }

        const stat = fs.statSync(filePath);
        return {
            success: true,
            exists: true,
            isFile: stat.isFile(),
            size: stat.size,
            name: path.basename(filePath),
            path: filePath,
        };
    } catch (error) {
        logger.error(error, { section: "getFileInfo" });
        return { success: false, exists: false, isFile: false, size: 0, name: "", path: filePath, message: "Error getting file info" };
    }
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};
