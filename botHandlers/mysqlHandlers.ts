import { Context, InlineKeyboard, InputFile } from "grammy";
import logger from "../core/logger";
import { isAdmin } from "../core/adminCheck";
import { UserState } from "../core/enums";
import { getUserData, setUserData, setUserState } from "../services/userDbServices";
import {
    mysqlListDatabases,
    mysqlCreateDatabase,
    mysqlListTables,
    mysqlRunQuery,
    mysqlGetLastRows,
    mysqlTableDetails,
} from "../services/mysqlServices";

/**
 * Shows the MySQL main menu with inline buttons
 */
export const mysqlMenuHandler = async (ctx: Context) => {
    try {
        if (!(await isAdmin(ctx))) return;

        let kb = new InlineKeyboard();
        kb.text("📋 Database List", "mysql_dblist").row();
        kb.text("➕ Create Database", "mysql_createdb").row();

        await ctx.reply("🗄️ MySQL Manager\n\nSelect an option:", {
            reply_markup: kb,
        });
    } catch (error) {
        logger.error(error, { section: "mysqlMenuHandler" });
        await ctx.reply("❌ Error showing MySQL menu.");
    }
};

/**
 * Handles all MySQL callback queries
 */
export const mysqlCallbackHandler = async (ctx: Context, action: string, params: string[]) => {
    try {
        if (!(await isAdmin(ctx))) return;

        let userId = ctx.from?.id as number;

        switch (action) {
            case "dblist": {
                let result = await mysqlListDatabases();

                if (!result.success) {
                    await ctx.reply(`❌ ${result.message}`);
                    return;
                }

                let kb = new InlineKeyboard();

                for (let db of result.databases) {
                    kb.text(db, `mysql_selectdb_${db}`).row();
                }

                kb.text("🔄 Refresh", "mysql_dblist").row();

                await ctx.reply("📋 Databases:", {
                    reply_markup: kb,
                });
                break;
            }

            case "createdb": {
                await setUserState(userId, UserState.mysql_create_db);
                await ctx.reply("📝 Enter the name for the new database:");
                break;
            }

            case "selectdb": {
                let dbName = params[0];

                if (!dbName) {
                    await ctx.reply("❌ No database selected.");
                    return;
                }

                let userData = (await getUserData(userId))?.data || {};
                userData.mysqlSelectedDb = dbName;
                await setUserData(userId, userData);

                let kb = new InlineKeyboard();
                kb.text("📝 Run Query", `mysql_query_${dbName}`).row();
                kb.text("📋 Tables List", `mysql_tables_${dbName}`).row();
                kb.text("⬅️ Back", "mysql_dblist").row();

                await ctx.reply(`🗄️ Database: ${dbName}\n\nSelect an option:`, {
                    reply_markup: kb,
                });
                break;
            }

            case "query": {
                let dbName = params[0];

                if (!dbName) {
                    await ctx.reply("❌ No database specified.");
                    return;
                }

                let userData = (await getUserData(userId))?.data || {};
                userData.mysqlSelectedDb = dbName;
                await setUserData(userId, userData);
                await setUserState(userId, UserState.mysql_run_query);

                await ctx.reply(`📝 Database: ${dbName}\n\nType your SQL query:`);
                break;
            }

            case "tables": {
                let dbName = params[0];

                if (!dbName) {
                    await ctx.reply("❌ No database specified.");
                    return;
                }

                let result = await mysqlListTables(dbName);

                if (!result.success) {
                    await ctx.reply(`❌ ${result.message}`);
                    return;
                }

                if (result.tables.length === 0) {
                    let kb = new InlineKeyboard();
                    kb.text("⬅️ Back", `mysql_selectdb_${dbName}`).row();

                    await ctx.reply(`📋 No tables found in '${dbName}'.`, {
                        reply_markup: kb,
                    });
                    return;
                }

                let kb = new InlineKeyboard();

                for (let table of result.tables) {
                    kb.text(`📊 Last 20 Rows`, `mysql_rows_${dbName}_${table}`)
                        .text(`ℹ️ Details`, `mysql_details_${dbName}_${table}`)
                        .row();
                    // Add table name as a label row
                    kb.text(`📄 ${table}`, `mysql_tables_${dbName}`).row();
                }

                kb.text("⬅️ Back", `mysql_selectdb_${dbName}`).row();

                await ctx.reply(`📋 Tables in '${dbName}':`, {
                    reply_markup: kb,
                });
                break;
            }

            case "rows": {
                let dbName = params[0];
                let tableName = params.slice(1).join("_");

                if (!dbName || !tableName) {
                    await ctx.reply("❌ Missing database or table name.");
                    return;
                }

                let result = await mysqlGetLastRows(dbName, tableName, 20);

                if (!result.success) {
                    await ctx.reply(`❌ ${result.message}`);
                    return;
                }

                let output = result.output;

                if (output.length > 4000) {
                    await ctx.replyWithDocument(
                        new InputFile(Buffer.from(output), "query_result.txt")
                    );
                } else {
                    await ctx.reply(`📊 Last 20 rows of '${tableName}':\n\n\`\`\`\n${output}\n\`\`\``, {
                        parse_mode: "Markdown",
                    });
                }
                break;
            }

            case "details": {
                let dbName = params[0];
                let tableName = params.slice(1).join("_");

                if (!dbName || !tableName) {
                    await ctx.reply("❌ Missing database or table name.");
                    return;
                }

                let result = await mysqlTableDetails(dbName, tableName);

                if (!result.success) {
                    await ctx.reply(`❌ ${result.message}`);
                    return;
                }

                await ctx.reply(`ℹ️ Structure of '${tableName}':\n\n\`\`\`\n${result.output}\n\`\`\``, {
                    parse_mode: "Markdown",
                });
                break;
            }

            default: {
                await ctx.reply("❌ Unknown MySQL action.");
                break;
            }
        }
    } catch (error) {
        logger.error(error, { section: "mysqlCallbackHandler" });
        await ctx.reply("❌ Error handling MySQL action.");
    }
};

/**
 * Handles text input for MySQL states
 */
export const mysqlMessageHandler = async (ctx: Context, state: string) => {
    try {
        if (!(await isAdmin(ctx))) return;

        let userId = ctx.from?.id as number;
        let text = ctx.message?.text?.trim();

        if (!text) {
            await ctx.reply("❌ Please send a valid text message.");
            return;
        }

        switch (state) {
            case "mysql_create_db": {
                let result = await mysqlCreateDatabase(text);
                await ctx.reply(result.message);
                await setUserState(userId, UserState.start);
                break;
            }

            case "mysql_run_query": {
                let userData = (await getUserData(userId))?.data || {};
                let dbName = userData.mysqlSelectedDb;

                if (!dbName) {
                    await ctx.reply("❌ No database selected. Please start over.");
                    await setUserState(userId, UserState.start);
                    return;
                }

                let result = await mysqlRunQuery(dbName, text);

                if (!result.success) {
                    await ctx.reply(`❌ Query failed:\n\n\`\`\`\n${result.output}\n\`\`\``, {
                        parse_mode: "Markdown",
                    });
                } else {
                    let output = result.output;

                    if (output.length > 4000) {
                        await ctx.replyWithDocument(
                            new InputFile(Buffer.from(output), "query_result.txt")
                        );
                    } else {
                        await ctx.reply(`✅ Query result:\n\n\`\`\`\n${output}\n\`\`\``, {
                            parse_mode: "Markdown",
                        });
                    }
                }

                await setUserState(userId, UserState.start);
                break;
            }

            default: {
                await ctx.reply("❌ Unknown MySQL state.");
                await setUserState(userId, UserState.start);
                break;
            }
        }
    } catch (error) {
        logger.error(error, { section: "mysqlMessageHandler" });
        await ctx.reply("❌ Error processing MySQL input.");
    }
};
