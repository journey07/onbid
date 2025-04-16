const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { startScheduler } = require('./lib/scheduler');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
    
    // Start the scheduler after the server is running
    const schedulerStarted = startScheduler();
    if (schedulerStarted) {
      console.log('> Scheduler started successfully');
    } else {
      console.error('> Failed to start scheduler');
    }
  });
}); 