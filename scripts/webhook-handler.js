#!/usr/bin/env node

/**
 * Simple webhook handler for automatic deployment
 * This script can be used to automatically deploy when changes are pushed to GitHub
 */

const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret';
const REPO_PATH = process.env.REPO_PATH || process.cwd();

// Middleware to parse JSON
app.use(express.json());

// Logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Also write to log file
  const logFile = path.join(__dirname, 'deployment.log');
  fs.appendFileSync(logFile, logMessage + '\n');
}

// Verify GitHub webhook signature
function verifySignature(payload, signature) {
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(payload);
  const digest = 'sha256=' + hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Execute deployment commands
function deploy(branch = 'master') {
  return new Promise((resolve, reject) => {
    log(`Starting deployment for branch: ${branch}`);
    
    const commands = [
      'git fetch origin',
      `git checkout ${branch}`,
      `git pull origin ${branch}`,
      'npm ci',
      'npm run build',
      'npm test',
      'pm2 restart talktomachine || npm start'
    ];
    
    let currentCommand = 0;
    
    function executeNext() {
      if (currentCommand >= commands.length) {
        log('✅ Deployment completed successfully');
        resolve();
        return;
      }
      
      const command = commands[currentCommand];
      log(`Executing: ${command}`);
      
      exec(command, { cwd: REPO_PATH }, (error, stdout, stderr) => {
        if (error) {
          log(`❌ Command failed: ${command}`);
          log(`Error: ${error.message}`);
          reject(error);
          return;
        }
        
        if (stdout) log(`Output: ${stdout.trim()}`);
        if (stderr) log(`Warning: ${stderr.trim()}`);
        
        currentCommand++;
        executeNext();
      });
    }
    
    executeNext();
  });
}

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    
    // Verify signature if secret is provided
    if (SECRET && SECRET !== 'your-webhook-secret') {
      if (!signature || !verifySignature(payload, signature)) {
        log('❌ Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    const event = req.headers['x-github-event'];
    const data = req.body;
    
    log(`Received ${event} event from GitHub`);
    
    // Handle push events
    if (event === 'push') {
      const branch = data.ref.replace('refs/heads/', '');
      const commits = data.commits || [];
      
      log(`Push to ${branch} branch with ${commits.length} commits`);
      
      // Only deploy on master/main branch pushes
      if (branch === 'master' || branch === 'main') {
        try {
          await deploy(branch);
          res.json({ 
            status: 'success', 
            message: `Deployment completed for ${branch}`,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          log(`❌ Deployment failed: ${error.message}`);
          res.status(500).json({ 
            status: 'error', 
            message: 'Deployment failed',
            error: error.message 
          });
        }
      } else {
        log(`Ignoring push to ${branch} branch`);
        res.json({ 
          status: 'ignored', 
          message: `Push to ${branch} branch ignored` 
        });
      }
    } else {
      log(`Ignoring ${event} event`);
      res.json({ 
        status: 'ignored', 
        message: `${event} event ignored` 
      });
    }
    
  } catch (error) {
    log(`❌ Webhook error: ${error.message}`);
    res.status(500).json({ 
      status: 'error', 
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'webhook-handler',
    timestamp: new Date().toISOString()
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  const logFile = path.join(__dirname, 'deployment.log');
  let recentLogs = [];
  
  try {
    if (fs.existsSync(logFile)) {
      const logs = fs.readFileSync(logFile, 'utf8').split('\n');
      recentLogs = logs.slice(-10).filter(log => log.trim());
    }
  } catch (error) {
    log(`Error reading log file: ${error.message}`);
  }
  
  res.json({
    status: 'running',
    port: PORT,
    recentLogs: recentLogs,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  log(`🚀 Webhook handler started on port ${PORT}`);
  log(`Health check: http://localhost:${PORT}/health`);
  log(`Status: http://localhost:${PORT}/status`);
  log(`Webhook URL: http://localhost:${PORT}/webhook`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});