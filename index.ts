import dotenv from "dotenv";
dotenv.config();

import bot from "./bot";

(async () => {
    await bot.init();
    console.log("Bot with username @" + bot.botInfo.username + " is running");
    await bot.start();
})();
