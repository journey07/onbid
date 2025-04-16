const { crawlOnbid } = require('../scripts/crawl');

// Function to check for new listings
async function checkForNewListings() {
  try {
    const result = await crawlOnbid();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to crawl Onbid');
    }
    
    return result.results || [];
  } catch (error) {
    console.error('Error in checkForNewListings:', error);
    return [];
  }
}

module.exports = {
  checkForNewListings
}; 