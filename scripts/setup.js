#!/usr/bin/env node

/**
 * Setup script for TalkToMachine platform
 * This script helps configure the environment for deployment
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function log(message) {
  console.log(`[SETUP] ${message}`);
}

async function createEnvFile() {
  log('Setting up environment configuration...');
  
  const envPath = path.join(process.cwd(), '.env');
  
  if (fs.existsSync(envPath)) {
    const overwrite = await question('.env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      log('Skipping .env file creation');
      return;
    }
  }
  
  log('Please provide the following configuration values:');
  
  const config = {
    NODE_ENV: await question('Environment (development/production) [development]: ') || 'development',
    PORT: await question('Server port [3000]: ') || '3000',
    MONGODB_URI: await question('MongoDB URI [mongodb://localhost:27017/talktomachine]: ') || 'mongodb://localhost:27017/talktomachine',
    FIREBASE_PROJECT_ID: await question('Firebase Project ID: '),
    FIREBASE_CLIENT_EMAIL: await question('Firebase Client Email: '),
    FIREBASE_PRIVATE_KEY: await question('Firebase Private Key (paste the full key): '),
    JWT_SECRET: await question('JWT Secret (leave empty to generate): ') || generateRandomString(64),
    RATE_LIMIT_WINDOW_MS: await question('Rate limit window in ms [900000]: ') || '900000',
    RATE_LIMIT_MAX_REQUESTS: await question('Rate limit max requests [100]: ') || '100'
  };
  
  // Add development-specific settings
  if (config.NODE_ENV === 'development') {
    config.ALLOW_NO_AUTH = 'true';
  }
  
  // Create .env content
  let envContent = '# TalkToMachine Platform Configuration\n';
  envContent += `# Generated on ${new Date().toISOString()}\n\n`;
  
  for (const [key, value] of Object.entries(config)) {
    if (key === 'FIREBASE_PRIVATE_KEY' && value) {
      // Handle private key formatting
      envContent += `${key}="${value.replace(/\\n/g, '\\n')}"\n`;
    } else {
      envContent += `${key}=${value}\n`;
    }
  }
  
  fs.writeFileSync(envPath, envContent);
  log('✅ .env file created successfully');
}

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function setupDatabase() {
  log('Database setup...');
  
  const setupDb = await question('Do you want to set up the database? (y/N): ');
  if (setupDb.toLowerCase() !== 'y') {
    log('Skipping database setup');
    return;
  }
  
  log('Database setup instructions:');
  log('1. Make sure MongoDB is running');
  log('2. The application will automatically create collections on first run');
  log('3. For production, consider setting up MongoDB Atlas or a managed instance');
  log('4. Ensure proper indexing for performance');
}

async function setupFirebase() {
  log('Firebase setup...');
  
  const setupFb = await question('Do you need help with Firebase setup? (y/N): ');
  if (setupFb.toLowerCase() !== 'y') {
    log('Skipping Firebase setup help');
    return;
  }
  
  log('Firebase setup instructions:');
  log('1. Go to https://console.firebase.google.com/');
  log('2. Create a new project or select existing one');
  log('3. Go to Project Settings > Service Accounts');
  log('4. Generate a new private key');
  log('5. Copy the project ID, client email, and private key to your .env file');
  log('6. Enable Authentication and Firestore in your Firebase console');
}

async function setupDeployment() {
  log('Deployment setup...');
  
  const setupDeploy = await question('Do you want to set up deployment? (y/N): ');
  if (setupDeploy.toLowerCase() !== 'y') {
    log('Skipping deployment setup');
    return;
  }
  
  const deploymentType = await question('Deployment type (docker/heroku/manual) [docker]: ') || 'docker';
  
  switch (deploymentType) {
    case 'docker':
      log('Docker deployment setup:');
      log('1. Make sure Docker is installed');
      log('2. Run: npm run docker:build');
      log('3. Run: npm run docker:compose');
      log('4. Your app will be available at http://localhost:3000');
      break;
      
    case 'heroku':
      log('Heroku deployment setup:');
      log('1. Install Heroku CLI');
      log('2. Run: heroku create your-app-name');
      log('3. Set environment variables: heroku config:set NODE_ENV=production');
      log('4. Deploy: git push heroku master');
      break;
      
    case 'manual':
      log('Manual deployment setup:');
      log('1. Set up your server with Node.js and MongoDB');
      log('2. Clone the repository on your server');
      log('3. Run: npm ci && npm run build');
      log('4. Set up a process manager like PM2');
      log('5. Configure reverse proxy (nginx) if needed');
      break;
  }
}

async function runTests() {
  log('Running tests to verify setup...');
  
  const runTestsNow = await question('Run tests now? (y/N): ');
  if (runTestsNow.toLowerCase() !== 'y') {
    log('Skipping tests');
    return;
  }
  
  const { exec } = require('child_process');
  
  return new Promise((resolve) => {
    exec('npm test', (error, stdout, stderr) => {
      if (error) {
        log('❌ Tests failed:');
        console.log(stderr);
      } else {
        log('✅ All tests passed!');
      }
      resolve();
    });
  });
}

async function main() {
  console.log('🚀 TalkToMachine Platform Setup');
  console.log('================================');
  console.log('This script will help you configure the platform for deployment.\n');
  
  try {
    await createEnvFile();
    await setupDatabase();
    await setupFirebase();
    await setupDeployment();
    await runTests();
    
    log('🎉 Setup completed successfully!');
    log('Next steps:');
    log('1. Review your .env file');
    log('2. Start the development server: npm run dev');
    log('3. Test the language detection: npm run language:demo');
    log('4. Deploy when ready: npm run deploy:production');
    
  } catch (error) {
    log(`❌ Setup failed: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };