# Server Manager Bot

A powerful Telegram bot designed to help system administrators and developers manage their Linux servers directly from Telegram. Built with TypeScript, grammY, and Prisma, this bot provides a secure and feature-rich interface for remote server administration.

## Key Features

This bot acts as a comprehensive remote control for your server, offering the following capabilities:

- **Bash Command Execution**: Run arbitrary shell commands directly from your chat.
- **File Explorer**: Browse your server's filesystem, view, and manage files.
- **Docker Management**: View and manage Docker containers, images, and volumes.
- **PM2 Process Manager**: Monitor and control applications managed by PM2.
- **NGINX Management**: Control NGINX server configurations and services.
- **MySQL Database Management**: Interact with and manage your MySQL databases.
- **Git Integration**: Manage Git repositories, pull changes, and view status.
- **Tmux Session Control**: Manage your background Tmux sessions.
- **Secure Admin System**: Built-in authentication (`/login`, `/logout`) ensures only authorized users can access sensitive server functions.

## Technology Stack

- **Bot Framework**: [grammY](https://grammy.dev/)
- **Language**: TypeScript
- **Database ORM**: [Prisma](https://www.prisma.io/) (with MariaDB/MySQL)
- **Logging**: Winston

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Docker](https://www.docker.com/) and Docker Compose (recommended for deployment)
- A Telegram Bot Token from [@BotFather](https://t.me/botfather)

## Setup and Installation

### 1. Environment Configuration

Clone the repository and set up the environment variables:

```bash
cp .env.example .env
```

Open `.env` and configure the essential variables:
- `BOT_TOKEN`: Your Telegram bot token.
- `INITUSERNAME` & `INITPASSWORD`: The credentials for the initial admin user.
- Database configurations.

### 2. Running with Docker Compose (Recommended)

To start the bot and its database container using Docker Compose:

```bash
docker-compose up -d --build
```

### 3. Running Locally (Development)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Make sure you have a MariaDB/MySQL database running and configure `DATABASE_URL` in `.env`.

3. Push the database schema:
   ```bash
   npx prisma db push
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Open Telegram and start a chat with your bot (`/start`).
2. Send `/login` and provide your `INITUSERNAME` and `INITPASSWORD` to authenticate.
3. Once logged in as an admin, use the interactive menus to access the server management features like Bash, Docker, PM2, and the File Explorer.
4. Send `/logout` when you are done to revoke your admin privileges.

## Security Warning

**⚠️ IMPORTANT**: This bot provides system-level access to your server via Telegram. Ensure you keep your bot token secure, use strong admin credentials, and consider running the bot user with restricted system permissions if you don't need full root access for all features.

## License

ISC
