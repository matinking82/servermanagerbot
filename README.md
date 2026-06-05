# BaseBot - Telegram Bot Boilerplate

BaseBot is a robust boilerplate for building Telegram bots using TypeScript, the [grammY](https://grammy.dev/) framework, and [Prisma](https://www.prisma.io/) ORM with MariaDB/MySQL. It provides built-in admin authentication, modular handler structures, logging, and an easy-to-deploy Docker Compose setup.

## Features

- **TypeScript** for static typing and modern JavaScript features.
- **grammY** framework for interacting with the Telegram Bot API.
- **Prisma ORM** coupled with MariaDB/MySQL for database management.
- **Admin System** with `/login` and `/logout` commands.
- **Auto Initialization** of the admin user on startup.
- **Winston logger** for flexible and structured logging.
- **Dockerized**: Includes `Dockerfile` and `docker-compose.yml` for quick and reproducible deployments.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Docker](https://www.docker.com/) and Docker Compose (if running via Docker)
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
- Database configurations (if running locally without Docker).

### 2. Running with Docker (Recommended)

The easiest way to start the bot and its database is using Docker Compose:

```bash
docker-compose up -d --build
```

This will start two containers:
1. `basebot-db`: MariaDB database container.
2. `basebot-app`: The Node.js application running the bot.

Prisma will automatically manage database migrations/pushes when the app starts using `docker-entrypoint.sh` (or you can run `npx prisma db push` manually within the container if needed).

### 3. Running Locally (Development)

To run the bot locally without Docker:

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

Once the bot is running:
- Open Telegram and search for your bot.
- Send `/start` to interact with it.
- Send `/login` and provide the `INITUSERNAME` and `INITPASSWORD` credentials to log in as an administrator.
- Send `/logout` to drop admin privileges.

## Project Structure

- `bot.ts` - Bot instance initialization and command routing.
- `index.ts` - Entry point that initializes the database (admin) and starts the bot.
- `botHandlers/` - Specific logic for commands and callbacks (e.g., `generalHandlers`, `adminHandlers`).
- `core/` - Core utilities like the Winston logger.
- `middlewares/` - Bot middlewares (e.g., `loginUserMiddleware`).
- `prisma/` - Prisma schema (`schema.prisma`) and configuration.
- `services/` - Business logic and database interaction services.

## License

ISC
