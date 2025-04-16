const cron = require('node-cron');
const { checkForNewListings } = require('./scraper');
const { notifyNewListings } = require('./telegram');
require('dotenv').config();

// Default schedule: Run every day at 9 AM
const DEFAULT_SCHEDULE = '0 9 * * *';

// Start the scheduler
const startScheduler = () => {
  const schedule = process.env.SCRAPE_INTERVAL || DEFAULT_SCHEDULE;
  
  if (!cron.validate(schedule)) {
    console.error(`Invalid cron schedule: ${schedule}`);
    return false;
  }
  
  console.log(`Starting scheduler with schedule: ${schedule}`);
  
  cron.schedule(schedule, async () => {
    console.log(`Running scheduled scrape at ${new Date().toISOString()}`);
    try {
      const newListings = await checkForNewListings();
      
      console.log(`Found ${newListings.length} new listings`);
      
      if (newListings.length > 0) {
        await notifyNewListings(newListings);
      }
    } catch (error) {
      console.error('Error during scheduled scrape:', error);
    }
  });
  
  return true;
};

// Run the scrape process once (for manual testing or API calls)
const runScrapeOnce = async () => {
  console.log(`Running manual scrape at ${new Date().toISOString()}`);
  try {
    const newListings = await checkForNewListings();
    
    console.log(`Found ${newListings.length} new listings`);
    
    if (newListings.length > 0) {
      await notifyNewListings(newListings);
    }
    
    return newListings;
  } catch (error) {
    console.error('Error during manual scrape:', error);
    return [];
  }
};

module.exports = {
  startScheduler,
  runScrapeOnce,
}; 