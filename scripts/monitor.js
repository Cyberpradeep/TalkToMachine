#!/usr/bin/env node

/**
 * Simple deployment monitoring script
 */

const https = require('https');
const http = require('http');

const config = {
  production: {
    url: 'https://your-production-url.com/health',
    name: 'Production'
  },
  staging: {
    url: 'https://your-staging-url.com/health',
    name: 'Staging'
  },
  local: {
    url: 'http://localhost:3000/health',
    name: 'Local'
  }
};

function checkHealth(environment) {
  const { url, name } = config[environment];
  const client = url.startsWith('https') ? https : http;
  
  return new Promise((resolve, reject) => {
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            environment: name,
            status: res.statusCode === 200 ? '✅ Healthy' : '❌ Unhealthy',
            statusCode: res.statusCode,
            response: response
          });
        } catch (error) {
          resolve({
            environment: name,
            status: '❌ Invalid Response',
            statusCode: res.statusCode,
            error: error.message
          });
        }
      });
    });
    
    req.on('error', (error) => {
      resolve({
        environment: name,
        status: '❌ Connection Failed',
        error: error.message
      });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        environment: name,
        status: '❌ Timeout',
        error: 'Request timeout after 5 seconds'
      });
    });
  });
}

async function monitorAll() {
  console.log('🔍 TalkToMachine Health Monitor');
  console.log('================================');
  console.log(`Timestamp: ${new Date().toISOString()}\n`);
  
  const environments = Object.keys(config);
  const results = await Promise.all(
    environments.map(env => checkHealth(env))
  );
  
  results.forEach(result => {
    console.log(`${result.environment}: ${result.status}`);
    if (result.statusCode) {
      console.log(`  Status Code: ${result.statusCode}`);
    }
    if (result.response) {
      console.log(`  Response: ${JSON.stringify(result.response, null, 2)}`);
    }
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    console.log('');
  });
  
  const healthyCount = results.filter(r => r.status.includes('✅')).length;
  const totalCount = results.length;
  
  console.log(`Summary: ${healthyCount}/${totalCount} environments healthy`);
  
  if (healthyCount === totalCount) {
    console.log('🎉 All systems operational!');
    process.exit(0);
  } else {
    console.log('⚠️  Some systems need attention');
    process.exit(1);
  }
}

// Run monitoring
if (require.main === module) {
  monitorAll().catch(console.error);
}

module.exports = { checkHealth, monitorAll };