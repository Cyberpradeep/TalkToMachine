# TalkToMachine Platform

An AI-powered multilingual chat platform with advanced Tanglish (Tamil-English mixed language) support, built with Node.js, TypeScript, and MongoDB.

## 🚀 Features

- **Multilingual Support**: Native support for Tamil, English, and Tanglish
- **Advanced Language Detection**: Intelligent detection of Tamil, English, and mixed Tanglish text
- **Enterprise-Ready**: Multi-tenant architecture with enterprise management
- **Real-time Chat**: WebSocket-based real-time messaging
- **Vector Search**: Advanced semantic search using vector embeddings
- **Firebase Integration**: Authentication and push notifications
- **Security First**: Comprehensive security middleware and validation
- **Scalable Architecture**: Modular design with clean separation of concerns

## 🛠️ Tech Stack

- **Backend**: Node.js, TypeScript, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Firebase Admin SDK
- **Language Processing**: Custom Tamil Unicode detection and Tanglish identification
- **Testing**: Jest with comprehensive test coverage
- **Security**: Helmet, rate limiting, input sanitization
- **Logging**: Winston for structured logging

## 📋 Prerequisites

- Node.js (v18 or higher)
- MongoDB (v5.0 or higher)
- Firebase project with Admin SDK credentials

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

4. **Start the development server**
   ```bash
   npm run dev
   ```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/__tests__/modules/query/language.test.ts
```

## 🌐 Language Detection Demo

Test the language detection capabilities:

```bash
npx ts-node src/modules/query/demo.ts
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

- `GET /health` - Health check endpoint
- `POST /auth/login` - User authentication
- `POST /auth/register` - User registration
- `GET /auth/profile` - Get user profile

## 🏗️ Project Structure

```
src/
├── config/          # Configuration files (database, Firebase, environment)
├── middleware/      # Express middleware (auth, security, validation)
├── models/          # MongoDB models (User, Enterprise, Query, etc.)
├── modules/         # Business logic modules
│   └── query/       # Language detection and query processing
├── routes/          # API route handlers
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── __tests__/       # Test files
```

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

- **Winston Logging**: Structured logging with multiple levels
- **Error Handling**: Comprehensive error handling middleware
- **Health Checks**: Built-in health monitoring endpoints

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker (Coming Soon)
```bash
docker build -t talktomachine .
docker run -p 3000:3000 talktomachine
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Pradeep** - Lead Developer - [@Cyberpradeep](https://github.com/Cyberpradeep)

## 🙏 Acknowledgments

- Tamil language processing community
- Firebase team for excellent authentication services
- MongoDB team for the robust database solution
- All contributors and testers

## 📞 Support

For support, email pradeepnaveen930@gmail.com or create an issue in this repository.

---

**Made with ❤️ for the Tamil-speaking community worldwide**
