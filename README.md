# TalkToMachine Platform

An AI-powered multilingual chat platform with advanced Tanglish (Tamil-English mixed language) support, built with Node.js, TypeScript, and MongoDB.

## 📋 Table of Contents

- [⚡ Quick Start](#-quick-start)
- [🚀 Features](#-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [📋 Prerequisites](#-prerequisites)
- [🔧 Installation](#-installation)
- [🧪 Testing](#-testing)
- [🌐 Language Detection Demo](#-language-detection-demo)
- [📚 API Documentation](#-api-documentation)
- [🏗️ Project Structure](#️-project-structure)
- [🔒 Security Features](#-security-features)
- [🌍 Multilingual Support](#-multilingual-support)
- [📊 Monitoring and Logging](#-monitoring-and-logging)
- [🔧 Troubleshooting](#-troubleshooting)
- [🚀 Deployment](#-deployment)
- [⚡ Performance Tips](#-performance-tips)
- [🤝 Contributing](#-contributing)
- [🗺️ Roadmap](#️-roadmap)
- [📞 Support & Resources](#-support--resources)

## ⚡ Quick Start

```bash
# Clone and setup
git clone https://github.com/Cyberpradeep/TalkToMachine.git
cd TalkToMachine
npm install

# Copy environment template
cp .env.example .env

# Start with Docker (recommended)
npm run docker:compose

# OR start development server
npm run dev
```

Visit `http://localhost:3000/health` to verify the setup.

## 🚀 Features

- **🌐 Multilingual Support**: Native support for Tamil, English, and Tanglish with intelligent language detection
- **🔍 Advanced Language Detection**: AI-powered detection of Tamil, English, and mixed Tanglish text with confidence scoring
- **🏢 Enterprise-Ready**: Multi-tenant architecture with role-based access control and enterprise management
- **💬 Real-time Communication**: WebSocket-based real-time messaging and notifications
- **🔍 Semantic Search**: Advanced vector search capabilities using embeddings for document retrieval
- **🔐 Firebase Integration**: Secure authentication and push notifications with Firebase Admin SDK
- **🛡️ Security First**: Comprehensive security middleware, rate limiting, and input validation
- **📊 Monitoring & Logging**: Built-in health checks, structured logging, and performance monitoring
- **🐳 Docker Support**: Complete containerization with Docker Compose for easy deployment
- **🚀 CI/CD Ready**: GitHub Actions workflows and webhook-based deployment automation

## 🛠️ Tech Stack

- **Backend**: Node.js (v18+), TypeScript, Express.js
- **Database**: MongoDB (v6.0) with Mongoose ODM
- **Cache**: Redis for session management and caching
- **Authentication**: Firebase Admin SDK with JWT tokens
- **Language Processing**: Custom Tamil Unicode detection, Tanglish identification, and language classification
- **Testing**: Jest with comprehensive test coverage and MongoDB Memory Server
- **Security**: Helmet.js, CORS, rate limiting, input sanitization with Joi validation
- **Logging**: Winston for structured logging with multiple levels
- **DevOps**: Docker & Docker Compose, GitHub Actions CI/CD
- **Monitoring**: Built-in health checks and performance metrics

## 📋 Prerequisites

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **MongoDB** (v6.0 or higher) - [Installation Guide](https://docs.mongodb.com/manual/installation/)
- **Redis** (v7 or higher) - [Installation Guide](https://redis.io/docs/install/)
- **Firebase Project** with Admin SDK credentials - [Setup Guide](https://firebase.google.com/docs/admin/setup)
- **Git** for version control
- **Docker** (optional) - For containerized deployment

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Cyberpradeep/TalkToMachine.git
   cd TalkToMachine
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   NODE_ENV=development
   PORT=3000
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/talktomachine
   
   # Firebase
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
   
   # Security
   JWT_SECRET=your-jwt-secret-key
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   
   # Development
   ALLOW_NO_AUTH=true
   ```

4. **Initialize the database** (optional)
   ```bash
   # If using Docker, skip this step
   # Make sure MongoDB is running locally
   sudo systemctl start mongod
   ```

5. **Run setup script** (optional)
   ```bash
   # Interactive setup for configuration
   npm run setup
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

The server will be available at `http://localhost:3000`

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Generate test coverage report
npm run test:coverage

# Run specific test file
npm test -- src/__tests__/modules/query/language.test.ts

# Lint code for style and errors
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Test Coverage
- **Language Detection**: Comprehensive tests for Tamil, English, and Tanglish detection
- **API Endpoints**: Integration tests for all REST API endpoints
- **Authentication**: Firebase auth and JWT token validation tests
- **Database**: MongoDB model validation and operation tests
- **Security**: Rate limiting, input validation, and security middleware tests

## 🌐 Language Detection Demo

Test the advanced language detection capabilities:

```bash
# Run interactive language detection demo
npm run language:demo

# Or run directly with ts-node
npx ts-node src/modules/query/demo.ts
```

**Example Usage:**
```typescript
import { LanguageDetectionService } from './src/modules/query/language';

// Test various language combinations
const examples = [
  'வணக்கம்',                    // Pure Tamil
  'Hello world',                // Pure English  
  'வணக்கம் how are you?',        // Tanglish
  'I am fine நன்றாக இருக்கேன்'  // Mixed content
];

for (const text of examples) {
  const result = await LanguageDetectionService.detectLanguage(text);
  console.log(`Text: "${text}"`);
  console.log(`Result:`, result);
}
```

## 📚 API Documentation

### Language Detection

The platform includes advanced language detection for Tamil, English, and Tanglish:

```typescript
import { LanguageDetectionService } from './src/modules/query/language';

// Detect language
const result = await LanguageDetectionService.detectLanguage('வணக்கம் how are you?');
console.log(result);
// Output: { detected_language: 'tanglish', confidence: 0.9, is_tanglish: true, tamil_ratio: 0.44 }
```

### Key Endpoints

#### Authentication
- `POST /auth/login` - User authentication with Firebase
- `POST /auth/register` - User registration
- `GET /auth/profile` - Get authenticated user profile
- `POST /auth/logout` - User logout

#### System
- `GET /health` - Health check endpoint with service status
- `GET /metrics` - System performance metrics (admin only)

#### Query Processing  
- `POST /query` - Process multilingual queries with language detection
- `GET /queries` - Get query history (paginated)
- `DELETE /queries/:id` - Delete specific query

#### Enterprise Management (Admin)
- `POST /admin/enterprises` - Create new enterprise
- `GET /admin/:enterprise_id/users` - Get enterprise users
- `POST /admin/:enterprise_id/users` - Add user to enterprise

#### File Upload
- `POST /upload/manual` - Upload documents for processing
- `GET /uploads` - List uploaded files
- `DELETE /uploads/:id` - Delete uploaded file

## 🏗️ Project Structure

```
TalkToMachine/
├── 📁 src/                     # Source code
│   ├── 📁 config/              # Configuration files (database, Firebase, environment)
│   ├── 📁 middleware/          # Express middleware (auth, security, validation)
│   ├── 📁 models/              # MongoDB models (User, Enterprise, Query, etc.)
│   ├── 📁 modules/             # Business logic modules
│   │   └── 📁 query/           # Language detection and query processing
│   ├── 📁 routes/              # API route handlers
│   ├── 📁 types/               # TypeScript type definitions
│   ├── 📁 utils/               # Utility functions and helpers
│   └── 📁 __tests__/           # Test files and fixtures
├── 📁 scripts/                 # Deployment and utility scripts
│   ├── 📄 deploy.js            # Deployment automation
│   ├── 📄 monitor.js           # System monitoring
│   ├── 📄 setup.js             # Interactive setup
│   └── 📄 webhook-handler.js   # Git webhook handler
├── 📁 .github/workflows/       # GitHub Actions CI/CD pipeline
├── 📄 docker-compose.yml       # Multi-service container setup
├── 📄 Dockerfile              # Container configuration
├── 📄 DEPLOYMENT.md            # Detailed deployment guide
├── 📄 PROJECT_STATUS.md        # Current project status
└── 📄 README.md               # This file
```

### Key Modules
- **🔤 Language Detection**: Advanced multilingual text analysis
- **🔐 Authentication**: Firebase-based user management  
- **📊 Query Processing**: AI-powered query understanding
- **🏢 Enterprise Management**: Multi-tenant architecture
- **📁 Document Processing**: File upload and indexing
- **🔔 Notifications**: Real-time alerts and messaging

## 🔒 Security Features

- **Authentication**: Firebase-based user authentication
- **Rate Limiting**: Configurable request rate limiting
- **Input Validation**: Joi-based request validation
- **Security Headers**: Helmet.js security headers
- **Input Sanitization**: XSS and injection prevention
- **CORS**: Configurable cross-origin resource sharing

## 🌍 Multilingual Support

### Tamil Unicode Support
- Full Tamil Unicode character detection (U+0B80–U+0BFF)
- Tamil text ratio calculation
- Common Tamil pattern recognition

### Tanglish Detection
- Mixed Tamil-English text identification
- Confidence scoring based on character ratios
- Configurable detection thresholds

### Language Detection Features
- Pattern-based detection for multiple languages
- Batch processing capabilities
- Performance optimized for real-time use

## 📊 Monitoring and Logging

### Built-in Monitoring
```bash
# Check system health and metrics
npm run monitor

# Watch system metrics in real-time
npm run monitor:watch

# Check service health
curl http://localhost:3000/health
```

### Logging Features
- **Winston Logging**: Structured logging with multiple levels (error, warn, info, debug)
- **Request Logging**: Morgan middleware for HTTP request logging
- **Error Handling**: Comprehensive error handling middleware with stack traces
- **Health Checks**: Built-in health monitoring for all services
- **Performance Metrics**: Response time, memory usage, and request volume tracking

### Log Levels
```env
# Set in .env file
LOG_LEVEL=debug  # Options: error, warn, info, debug
NODE_ENV=development  # Enables detailed error messages
```

## 🔧 Troubleshooting

### Common Issues

#### MongoDB Connection Failed
```bash
# Check MongoDB status
sudo systemctl status mongod

# Start MongoDB service
sudo systemctl start mongod

# Or use Docker
npm run docker:compose
```

#### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

#### Firebase Authentication Issues
1. Verify Firebase project configuration in `.env`
2. Check service account permissions
3. Ensure Firebase Admin SDK is properly initialized
4. For development, set `ALLOW_NO_AUTH=true` in `.env`

#### Build Errors
```bash
# Clean and rebuild
npm run clean
npm run build

# Check TypeScript errors
npx tsc --noEmit
```

### Debug Mode
Enable verbose logging:
```env
NODE_ENV=development
DEBUG=talktomachine:*
LOG_LEVEL=debug
```

### Getting Help
1. Check the [Issues](https://github.com/Cyberpradeep/TalkToMachine/issues) page
2. Review [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment-specific issues
3. Run `npm run monitor` to check system health
4. Enable debug logging for detailed error information

## ⚡ Performance Tips

### Production Optimization
```bash
# Use PM2 for production process management
npm install -g pm2
pm2 start dist/server.js --name talktomachine

# Enable production optimizations
NODE_ENV=production npm start
```

### Database Performance
```javascript
// Use MongoDB indexes for better query performance
// Language detection queries are optimized with proper indexing
// Connection pooling is configured for high concurrency
```

### Memory Management
- Language detection models are lazy-loaded to reduce startup time
- Redis caching improves response times for frequent queries  
- Connection pooling prevents memory leaks
- Garbage collection is optimized for Node.js v18+

### Scaling Recommendations
- Use Docker Compose for multi-instance deployments
- Configure Redis for session sharing across instances
- Set up MongoDB replica sets for high availability
- Use a reverse proxy (Nginx) for load balancing
- Monitor memory usage with `npm run monitor`

## 🚀 Deployment

### Local Development
```bash
# Start development server with hot reload
npm run dev

# The server will be available at http://localhost:3000
```

### Production Build
```bash
# Build and start production server
npm run build
npm start

# Or build and deploy
npm run deploy:production
```

### Docker Deployment

#### Using Docker Compose (Recommended)
```bash
# Build and start all services (app, MongoDB, Redis)
npm run docker:compose

# Services will be available at:
# - App: http://localhost:3000
# - MongoDB: mongodb://localhost:27017
# - Redis: redis://localhost:6379

# Stop all services
npm run docker:down
```

#### Using Docker Build
```bash
# Build Docker image
npm run docker:build

# Run container (requires external MongoDB)
npm run docker:run
```

### CI/CD Deployment

#### GitHub Actions
The repository includes automated CI/CD workflows:
- **Pull Request**: Runs tests and linting
- **Main Branch**: Deploys to production after successful tests
- **Develop Branch**: Deploys to staging environment

#### Webhook Deployment
For automatic deployment on git push:
```bash
# Start webhook handler
npm run webhook

# Configure webhook in GitHub:
# URL: http://your-server:9000/webhook
# Content-type: application/json
# Events: push
```

### Cloud Deployment

#### Heroku
```bash
# Deploy to Heroku
heroku create your-app-name
git push heroku main
```

#### AWS/GCP/Azure
See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed cloud deployment instructions.

## 🤝 Contributing

We welcome contributions! Please follow these steps:

### Development Workflow

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/TalkToMachine.git
   cd TalkToMachine
   ```

2. **Setup Development Environment**
   ```bash
   npm install
   cp .env.example .env
   # Configure your .env file
   ```

3. **Create Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

4. **Development Best Practices**
   - Write TypeScript with strict type checking
   - Follow existing code style and patterns
   - Add comprehensive tests for new features
   - Update documentation as needed
   - Use meaningful commit messages

5. **Testing and Quality Checks**
   ```bash
   # Run tests
   npm test
   
   # Check linting
   npm run lint
   
   # Fix linting issues
   npm run lint:fix
   
   # Check test coverage
   npm run test:coverage
   ```

6. **Submit Changes**
   ```bash
   git add .
   git commit -m 'Add amazing feature'
   git push origin feature/amazing-feature
   ```

7. **Open Pull Request**
   - Provide clear description of changes
   - Include screenshots for UI changes
   - Ensure all CI checks pass
   - Request review from maintainers

### Code Style Guidelines
- Use TypeScript strict mode
- Follow ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Use async/await over promises

## 🗺️ Roadmap

### Current Version (v1.0.0)
- ✅ Core language detection system
- ✅ Multi-tenant architecture
- ✅ Firebase authentication
- ✅ Docker deployment support
- ✅ Comprehensive testing suite

### Upcoming Features (v1.1.0)
- 🔄 Admin dashboard (React)
- 🔄 Real-time notifications
- 🔄 Document upload and processing
- 🔄 Advanced query analytics
- 🔄 Mobile app support

### Future Plans (v2.0.0)
- 🔮 AI-powered response generation
- 🔮 Voice processing (STT/TTS)
- 🔮 Enhanced security features
- 🔮 Multi-language expansion
- 🔮 Advanced monitoring dashboard

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Pradeep** - Lead Developer - [@Cyberpradeep](https://github.com/Cyberpradeep)

## 🙏 Acknowledgments

- Tamil language processing community for linguistic insights
- Firebase team for robust authentication services
- MongoDB team for the scalable database solution
- Redis team for high-performance caching
- All contributors, testers, and community members
- Open-source community for the excellent tools and libraries

## 📞 Support & Resources

### Documentation
- **README**: This comprehensive guide
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Detailed deployment instructions
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)**: Current development status

### Getting Help
- 📧 **Email**: pradeepnaveen930@gmail.com
- 🐛 **Issues**: [GitHub Issues](https://github.com/Cyberpradeep/TalkToMachine/issues)
- 📖 **Docs**: Check the `/docs` folder for additional documentation
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Cyberpradeep/TalkToMachine/discussions)

### Quick Links
- **Repository**: https://github.com/Cyberpradeep/TalkToMachine
- **Live Demo**: Coming soon!
- **API Documentation**: Available at `/docs` endpoint when running
- **Health Check**: `/health` endpoint for system status

---

**Made with ❤️ for the Tamil-speaking community worldwide**

*Connecting cultures through technology, one conversation at a time.*
