import dotenv from "dotenv";
dotenv.config();

import bot from "./bot";
import { initializeAdmin } from "./services/adminDbServices";

(async () => {
    let adminInit = await initializeAdmin();
    console.log("Admin initialization: " + adminInit.message);
    await bot.init();
    console.log("Bot with username @" + bot.botInfo.username + " is running");
    await bot.start();
})();
