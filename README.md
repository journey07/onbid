# Onbid Monitoring Bot

A web application that monitors [Onbid](https://www.onbid.co.kr) for new listings and sends Telegram notifications when new items are found.

## Features

- Scrapes Onbid website on a regular schedule
- Detects new listings by comparing with previously stored data
- Sends Telegram notifications for new listings
- Provides a simple web interface to view the latest listings
- Allows manual triggering of the scraping process

## Setup

### Prerequisites

- Node.js (v14 or later)
- A Telegram bot token (create one via [BotFather](https://t.me/botfather))
- Your Telegram chat ID to receive notifications

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and update with your Telegram bot token and chat ID:
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_telegram_chat_id
   SCRAPE_INTERVAL="0 9 * * *"  # Runs every day at 9 AM
   ONBID_URL=https://www.onbid.co.kr/op/ppa/selectPublicSaleList.do
   ```

### Running the Application

#### Development mode

```
npm run dev
```

#### Production mode

```
npm run build
npm start
```

## Usage

1. Access the web interface at `http://localhost:3000`
2. The system will automatically check for new listings based on the schedule in your `.env` file
3. You can manually trigger a scrape by clicking the "Refresh Listings" button on the web interface or by sending a POST request to `/api/trigger-scrape`
4. When new listings are found, you'll receive Telegram notifications

## Customization

- Adjust the scrape interval by changing the `SCRAPE_INTERVAL` in your `.env` file (uses cron syntax)
- Modify the scraper in `lib/scraper.js` if the Onbid website structure changes
- Customize the notification format in `lib/telegram.js`

## Deployment

For production deployment, it's recommended to use a process manager like PM2:

```
npm install -g pm2
pm2 start server.js
```

## License

MIT 