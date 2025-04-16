const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Initialize the Telegram bot with the token from environment variable
const initBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not defined in the environment variables');
    return null;
  }
  
  try {
    // Create a bot that uses 'polling' to fetch new updates
    return new TelegramBot(token, { polling: false });
  } catch (error) {
    console.error('Error initializing Telegram bot:', error);
    return null;
  }
};

// Send a message to a specific chat
const sendMessage = async (message) => {
  const bot = initBot();
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!bot || !chatId) {
    console.error('Telegram bot or chat ID not properly configured');
    return false;
  }
  
  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
};

// Format the listing information for Telegram message
const formatListingMessage = (listing) => {
  return `
<b>New Listing Found!</b>
<b>Title:</b> ${escapeHtml(listing.title)}
<b>Price:</b> ${escapeHtml(listing.price)}
<b>Date:</b> ${escapeHtml(listing.date)}
<b>Link:</b> <a href="${listing.link}">View Listing</a>
`;
};

// Send notification for new listings
const notifyNewListings = async (newListings) => {
  if (!newListings || newListings.length === 0) {
    console.log('No new listings to notify about');
    return;
  }
  
  // Send a message for each new listing
  const results = await Promise.all(
    newListings.map(async (listing) => {
      const message = formatListingMessage(listing);
      return await sendMessage(message);
    })
  );
  
  const successCount = results.filter(Boolean).length;
  console.log(`Sent ${successCount}/${newListings.length} notifications about new listings`);
};

// Escape HTML special characters to prevent formatting issues in Telegram messages
const escapeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

module.exports = {
  sendMessage,
  notifyNewListings,
  formatListingMessage,
}; 