# TalkToMachine Deployment Guide

This guide covers various deployment options for the TalkToMachine platform.

## 🚀 Quick Start

1. **Initial Setup**
   ```bash
   npm run setup
   ```
   This interactive script will help you configure environment variables and deployment settings.

2. **Development**
   ```bash
   npm run dev
   ```

3. **Production Build**
   ```bash
   npm run build
   npm start
   ```

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 5.0+
- Firebase project (for authentication)
- Git (for deployment automation)

## 🔧 Environment Configuration

Create a `.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/talktomachine

# Firebase Authentication
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Security
JWT_SECRET=your-super-secret-jwt-key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Development Only
ALLOW_NO_AUTH=false
```

## 🐳 Docker Deployment

### Option 1: Docker Compose (Recommended)

```bash
# Build and start all services
npm run docker:compose

# Stop services
npm run docker:down
```

This will start:
- TalkToMachine app on port 3000
- MongoDB on port 27017
- Redis on port 6379

### Option 2: Docker Build

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run
```

### Docker Environment Variables

Create a `docker.env` file for Docker deployments:

```env
NODE_ENV=production
MONGODB_URI=mongodb://mongo:27017/talktomachine
REDIS_URL=redis://redis:6379
```

## ☁️ Cloud Deployment

### Heroku

1. **Setup**
   ```bash
   heroku create your-app-name
   heroku addons:create mongolab:sandbox
   ```

2. **Configure Environment**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set FIREBASE_PROJECT_ID=your-project-id
   heroku config:set FIREBASE_CLIENT_EMAIL=your-email
   heroku config:set FIREBASE_PRIVATE_KEY="your-private-key"
   heroku config:set JWT_SECRET=your-jwt-secret
   ```

3. **Deploy**
   ```bash
   git push heroku master
   ```

### AWS EC2

1. **Server Setup**
   ```bash
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Install MongoDB
   wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
   sudo apt-get install -y mongodb-org

   # Install PM2
   sudo npm install -g pm2
   ```

2. **Application Deployment**
   ```bash
   # Clone repository
   git clone https://github.com/Cyberpradeep/TalkToMachine.git
   cd TalkToMachine

   # Install dependencies and build
   npm ci
   npm run build

   # Start with PM2
   pm2 start dist/server.js --name talktomachine
   pm2 startup
   pm2 save
   ```

3. **Nginx Configuration**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Google Cloud Platform

1. **App Engine Deployment**
   
   Create `app.yaml`:
   ```yaml
   runtime: nodejs20
   
   env_variables:
     NODE_ENV: production
     MONGODB_URI: your-mongodb-uri
     FIREBASE_PROJECT_ID: your-project-id
   
   automatic_scaling:
     min_instances: 1
     max_instances: 10
   ```

   Deploy:
   ```bash
   gcloud app deploy
   ```

2. **Cloud Run Deployment**
   ```bash
   # Build and push to Container Registry
   gcloud builds submit --tag gcr.io/your-project/talktomachine

   # Deploy to Cloud Run
   gcloud run deploy talktomachine \
     --image gcr.io/your-project/talktomachine \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

## 🔄 Continuous Deployment

### GitHub Actions (Automated)

The repository includes a GitHub Actions workflow (`.github/workflows/ci-cd.yml`) that automatically:

1. Runs tests on push/PR
2. Builds the application
3. Deploys to staging (develop branch)
4. Deploys to production (master branch)

### Webhook Deployment

For automatic deployment on git push:

1. **Start Webhook Handler**
   ```bash
   npm run webhook
   ```

2. **Configure GitHub Webhook**
   - Go to your repository settings
   - Add webhook: `http://your-server:9000/webhook`
   - Set content type: `application/json`
   - Add secret (same as WEBHOOK_SECRET env var)

3. **Environment Variables for Webhook**
   ```env
   WEBHOOK_PORT=9000
   WEBHOOK_SECRET=your-webhook-secret
   REPO_PATH=/path/to/your/repo
   ```

## 📊 Monitoring and Health Checks

### Health Monitoring

```bash
# Check application health
npm run monitor

# Continuous monitoring
npm run monitor:watch
```

### Application Logs

```bash
# PM2 logs
pm2 logs talktomachine

# Docker logs
docker logs talktomachine

# Application logs (Winston)
tail -f logs/app.log
```

### Performance Monitoring

The application includes built-in health checks at `/health` endpoint:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "used": "50MB",
    "total": "100MB"
  },
  "database": "connected"
}
```

## 🔒 Security Considerations

### Production Security Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secrets
- [ ] Enable HTTPS/SSL
- [ ] Configure rate limiting
- [ ] Set up firewall rules
- [ ] Enable MongoDB authentication
- [ ] Use environment variables for secrets
- [ ] Regular security updates
- [ ] Monitor for vulnerabilities

### SSL/HTTPS Setup

For production deployments, always use HTTPS:

```bash
# Let's Encrypt with Certbot
sudo certbot --nginx -d your-domain.com
```

## 🚨 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   ```bash
   # Check MongoDB status
   sudo systemctl status mongod
   
   # Start MongoDB
   sudo systemctl start mongod
   ```

2. **Port Already in Use**
   ```bash
   # Find process using port
   lsof -i :3000
   
   # Kill process
   kill -9 <PID>
   ```

3. **Firebase Authentication Issues**
   - Verify Firebase credentials
   - Check project ID and service account
   - Ensure proper permissions

4. **Memory Issues**
   ```bash
   # Increase Node.js memory limit
   node --max-old-space-size=4096 dist/server.js
   ```

### Debug Mode

Enable debug logging:

```env
NODE_ENV=development
DEBUG=talktomachine:*
LOG_LEVEL=debug
```

## 📞 Support

For deployment issues:

1. Check the logs first
2. Verify environment configuration
3. Test with `npm run monitor`
4. Create an issue on GitHub
5. Contact support team

## 🔄 Rollback Procedures

### Quick Rollback

```bash
# Git rollback
git revert HEAD
git push origin master

# PM2 rollback
pm2 reload talktomachine

# Docker rollback
docker run -p 3000:3000 talktomachine:previous-tag
```

### Database Rollback

Always backup before deployment:

```bash
# MongoDB backup
mongodump --db talktomachine --out backup/

# Restore if needed
mongorestore backup/talktomachine/
```

---

**Happy Deploying! 🚀**