import { runScrapeOnce } from '../../lib/scheduler';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const newListings = await runScrapeOnce();
    res.status(200).json({ 
      success: true, 
      message: `Found ${newListings.length} new listings`,
      newListings 
    });
  } catch (error) {
    console.error('Error triggering scrape:', error);
    res.status(500).json({ error: 'Failed to trigger scrape' });
  }
} 