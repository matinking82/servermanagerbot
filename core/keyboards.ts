import { Keyboard, InlineKeyboard } from "grammy";

export const cancelOptions = {
    cancel: "❌ Cancel",
}

export const cancelKeyboard = () => {
    let kb = new Keyboard();

    for (let key in cancelOptions) {
        kb.text(cancelOptions[key]).row();
    }

    kb.resize_keyboard = true;

    return kb;
};

export const menuOptions = {
    bash: "🖥️ Bash Terminal",
    pm2: "📦 PM2 Manager",
    tmux: "🪟 Tmux Manager",
    docker: "🐳 Docker Manager",
    nginx: "🌐 Nginx Manager",
    mysql: "🗄️ MySQL Manager",
    files: "📂 File Explorer",
}

export const menuKeyboard = () => {
    let kb = new Keyboard();

    kb.text(menuOptions.bash).row();
    kb.text(menuOptions.pm2).text(menuOptions.tmux).row();
    kb.text(menuOptions.docker).text(menuOptions.nginx).row();
    kb.text(menuOptions.mysql).text(menuOptions.files).row();

    kb.resize_keyboard = true;

    return kb;
};

export const adminMainMenu = () => {
    let kb = new InlineKeyboard();

    kb.text("🖥️ Bash Terminal", "menu_bash").row();
    kb.text("📦 PM2", "menu_pm2").text("🪟 Tmux", "menu_tmux").row();
    kb.text("🐳 Docker", "menu_docker").text("🌐 Nginx", "menu_nginx").row();
    kb.text("🗄️ MySQL", "menu_mysql").text("📂 Files", "menu_files").row();

    return kb;
};