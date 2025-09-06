# TalkToMachine (MERN MVP)

An AI-powered vernacular voice + text assistant for MSME machine operators, with admin, super admin, and operator roles. Our team is currently working on this MVP to revolutionize how machine operators interact with equipment through intelligent voice and text assistance.

## 🎯 Core Features

### Operator App (Web + Mobile-friendly)
- **Query Input**: Voice (speech-to-text) and text queries
- **Machine Intelligence**: Ask about machine operations, troubleshooting, or handling
- **Smart Search**: AI searches uploaded manuals and FAQs using LangChain + FAISS
- **Local Language Support**: Response in local language with both text + voice (TTS)
- **Critical Issue Detection**: If query indicates critical issue → shows warning "Do not touch, wait for technician" + alerts admin

### Admin Dashboard
- **Document Management**: Upload machine manuals, SOPs, troubleshooting guides (PDF, DOC, text, images)
- **Real-time Monitoring**: View all operator queries in real time
- **Instant Notifications**: Get notified immediately via Firebase Cloud Messaging or email when operators ask questions
- **Query History**: View logs of past queries (stored until deleted by admin)

### Super Admin (Enterprise Level)
- **Multi-Enterprise Management**: Manage multiple enterprises from single dashboard
- **Admin Management**: Add/remove enterprise admins
- **Usage Analytics**: Oversee high-level usage data across all enterprises

### Enterprise Admin
- **Operator Management**: Add/remove operators for their enterprise
- **Resource Assignment**: Assign machines and manuals to specific operators
- **Critical Alerts**: Receive immediate alerts when operators face critical issues

### Critical Issue Detection
- **NLP Processing**: Uses Rasa NLU or Hugging Face intent classification to detect query severity
- **Safety Protocols**: High severity issues → immediate admin notification + operator blocked from risky actions
- **Real-time Alerts**: Instant notifications categorized as info/warning/critical

### Notifications System
- **Real-time Alerts**: Firebase Cloud Messaging for instant admin notifications (free tier)
- **Categorized Alerts**: Notifications sorted by severity (info/warning/critical)
- **Multi-channel**: Email and push notification support

## 🧑‍💻 Tech Stack

### Frontend
- **React**: Modern UI library with Material UI components
- **Design**: Clean, minimal, mobile-responsive interface
- **Styling**: Material UI with industrial design principles

### Backend
- **Node.js + Express**: RESTful API server
- **Authentication**: JWT-based authentication with role management (Operator, Admin, Super Admin)

### Database
- **MongoDB Atlas**: Document database (free tier)
- **Schemas**: User, Enterprise, Manual, QueryLog, Notification

### AI Processing
- **LangChain + FAISS**: Semantic search in uploaded manuals
- **Hugging Face**: Free models for intent classification (critical vs normal issues)
- **Speech-to-Text**: Vosk (offline, free) or Google Speech-to-Text free tier
- **Text-to-Speech**: Coqui TTS (open-source, free)

### Notifications & Storage
- **Firebase Cloud Messaging**: Free tier for real-time notifications
- **Firebase Storage**: Free tier for manual storage
- **Real-time Updates**: WebSocket connections for instant communication

## 🎨 UI Guidelines

- **Primary Color**: Dark Blue (#293B5F) - Professional and trustworthy
- **Background**: Light Gray (#F0F4F8) - Clean and non-distracting  
- **Accent Color**: Orange (#E67700) - For alerts & warnings
- **Typography**: Inter (Google Fonts) - Clean and highly readable
- **Design Philosophy**: Clean, industrial, easy-to-read → not flashy, but clear and functional
- **Iconography**: Icons for machine parts, warnings, upload, and operational states

## 📂 Project Structure

```
/client → React frontend
  ├── components/     # Reusable UI components
  ├── pages/         # Main application pages
  ├── hooks/         # Custom React hooks
  ├── services/      # API service calls
  └── utils/         # Frontend utilities

/server → Express backend with routes for:
  ├── /auth          # Login/register for all roles
  ├── /operator      # Query processing, STT/TTS endpoints
  ├── /admin         # Manual upload, query logs, alert management
  ├── /superadmin    # Enterprise-level control and analytics
  └── /enterprise    # Enterprise admin operations

MongoDB Schemas:
  ├── User           # All user types with role-based access
  ├── Enterprise     # Company/organization management
  ├── Manual         # Uploaded documentation and guides
  ├── QueryLog       # Historical query records
  └── Notification   # Alert and notification management
```

## 🚀 MVP Workflow

1. **Operator Login** → Authenticate and access assigned machines
2. **Query Input** → Voice or text input about machine operations
3. **AI Processing** → Backend processes query using LangChain + FAISS search
4. **Response Delivery** → AI response delivered in local language (text + voice)
5. **Critical Issue Detection** → If severity = high → operator warned, admin alerted immediately
6. **Admin Response** → Admin sees query in real-time and can take appropriate action
7. **Enterprise Management** → Super admin oversees multiple enterprises and usage analytics

## 🆓 Free APIs & Tools Used

- **Speech-to-Text**: Vosk (local, offline processing) - completely free
- **Text-to-Speech**: Coqui TTS (open-source, local processing) - completely free
- **AI NLP**: Hugging Face free inference API for intent classification
- **Manual Search**: LangChain + FAISS (open-source vector search)
- **Authentication**: JWT (self-implemented, no external API costs)
- **Notifications**: Firebase Cloud Messaging (free tier: 10GB/month)
- **Storage**: Firebase Storage (free tier: 1GB)
- **Database**: MongoDB Atlas (free tier: 512MB)

## 📋 Prerequisites

- Node.js (v18 or higher)
- MongoDB (v5.0 or higher)  
- Firebase project with Admin SDK credentials
- Python 3.8+ (for AI processing components)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Cyberpradeep/TalkToMachine.git
   cd TalkToMachine
   ```

2. **Install dependencies**
   ```bash
   # Backend dependencies
   npm install
   
   # Frontend dependencies
   cd client
   npm install
   cd ..
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   NODE_ENV=development
   PORT=3000
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/talktomachine
   
   # Firebase Configuration
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
   
   # AI Processing
   HUGGINGFACE_API_KEY=your-huggingface-api-key
   VOSK_MODEL_PATH=./models/vosk-model
   COQUI_TTS_MODEL=tts_models/multilingual/multi-dataset/your_tts
   
   # Security
   JWT_SECRET=your-jwt-secret-key-for-authentication
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   
   # Development
   ALLOW_NO_AUTH=true
   ```

4. **Download AI Models (Optional for development)**
   ```bash
   # Download Vosk speech recognition model
   wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
   unzip vosk-model-small-en-us-0.15.zip -d models/
   
   # Coqui TTS models will be downloaded automatically on first use
   ```

5. **Start the development servers**
   ```bash
   # Start backend server
   npm run dev
   
   # In another terminal, start frontend
   cd client
   npm start
   ```

   The backend will run on http://localhost:3000 and frontend on http://localhost:3001

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all backend tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Test specific features
npm test -- --testNamePattern="language detection"
npm test -- --testNamePattern="critical issue detection"
```

## 🎙️ Voice & AI Demo

Test the AI and voice processing capabilities:

```bash
# Test language detection and processing
npx ts-node src/modules/query/demo.ts

# Test voice processing (requires microphone)
npm run demo:voice

# Test manual search functionality
npm run demo:search
```

## 📚 API Documentation

### Core Endpoints

#### Authentication
- `POST /auth/register` - Register new users (operators, admins, super admins)
- `POST /auth/login` - User authentication with role-based access
- `GET /auth/profile` - Get current user profile and permissions
- `PUT /auth/profile` - Update user profile information

#### Operator Endpoints
- `POST /operator/query` - Submit voice or text query about machine operations
- `POST /operator/voice` - Upload voice recording for speech-to-text processing
- `GET /operator/history` - Get operator's query history
- `GET /operator/machines` - Get assigned machines and their manuals

#### Admin Endpoints  
- `POST /admin/manuals` - Upload machine manuals and documentation
- `GET /admin/queries` - Get real-time operator queries
- `GET /admin/notifications` - Get all notifications and alerts
- `PUT /admin/queries/:id/respond` - Respond to operator queries
- `GET /admin/operators` - List all operators in enterprise

#### Super Admin Endpoints
- `GET /superadmin/enterprises` - List all enterprises
- `POST /superadmin/enterprises` - Create new enterprise
- `GET /superadmin/analytics` - Get platform-wide usage analytics
- `POST /superadmin/admins` - Add new enterprise admins

### Query Processing Flow

```typescript
// Example operator query processing
const queryResult = await processOperatorQuery({
  text: "Machine making strange noise, what should I do?",
  operatorId: "op123",
  machineId: "machine456",
  timestamp: new Date(),
  language: "en" // or detected automatically
});

// Response format
{
  response: "Stop the machine immediately and check...",
  severity: "high", // low, medium, high, critical
  actions: ["stop_machine", "call_technician"],
  audioResponse: "base64-encoded-tts-audio",
  manualReferences: ["manual1.pdf", "sop2.doc"]
}
```

### Critical Issue Detection

```typescript
// Example critical issue detection
const issueAnalysis = await detectCriticalIssue({
  query: "Machine is sparking and smoking",
  context: "operator_floor_shift_a"
});

// Critical response format
{
  isCritical: true,
  severity: "critical",
  warningMessage: "STOP IMMEDIATELY - Do not touch, wait for technician",
  adminAlert: true,
  restrictOperatorAccess: true,
  emergencyContacts: ["admin@company.com", "+1234567890"]
}
```

## 🏗️ Project Structure

```
TalkToMachine/
├── client/                 # React Frontend Application
│   ├── public/            # Static assets
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   │   ├── operator/  # Operator-specific components
│   │   │   ├── admin/     # Admin dashboard components
│   │   │   └── common/    # Shared components
│   │   ├── pages/         # Application pages/views
│   │   │   ├── operator/  # Operator interface pages
│   │   │   ├── admin/     # Admin dashboard pages  
│   │   │   └── superadmin/ # Super admin pages
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API service calls
│   │   ├── utils/         # Frontend utilities
│   │   └── styles/        # CSS and styling files
│   └── package.json
│
├── server/                # Express Backend API
│   ├── src/
│   │   ├── config/        # Configuration (database, Firebase, environment)
│   │   ├── middleware/    # Express middleware (auth, security, validation)
│   │   ├── models/        # MongoDB models
│   │   │   ├── User.ts    # User management (operators, admins, super admins)
│   │   │   ├── Enterprise.ts # Enterprise/company management
│   │   │   ├── Manual.ts  # Uploaded documentation storage
│   │   │   ├── QueryLog.ts # Query history and analytics
│   │   │   └── Notification.ts # Alert and notification system
│   │   ├── modules/       # Business logic modules
│   │   │   ├── ai/        # AI processing (LangChain, Hugging Face)
│   │   │   ├── voice/     # Speech-to-text and TTS processing
│   │   │   ├── search/    # FAISS vector search implementation
│   │   │   └── alerts/    # Critical issue detection and notification
│   │   ├── routes/        # API route handlers
│   │   │   ├── auth.ts    # Authentication endpoints
│   │   │   ├── operator.ts # Operator-specific endpoints
│   │   │   ├── admin.ts   # Admin dashboard endpoints
│   │   │   └── superadmin.ts # Super admin endpoints
│   │   ├── types/         # TypeScript type definitions
│   │   ├── utils/         # Utility functions and helpers
│   │   └── __tests__/     # Test files and test utilities
│   └── package.json
│
├── ai-models/             # AI model storage and configuration
│   ├── vosk/             # Speech recognition models
│   ├── coqui-tts/        # Text-to-speech models  
│   └── huggingface/      # NLP models for intent classification
│
├── docs/                  # Documentation
│   ├── API.md            # API documentation
│   ├── DEPLOYMENT.md     # Deployment guides
│   └── CONTRIBUTING.md   # Contribution guidelines
│
├── scripts/              # Utility scripts
│   ├── setup.js          # Initial setup and configuration
│   ├── deploy.js         # Deployment automation
│   └── seed-data.js      # Database seeding for development
│
└── docker-compose.yml    # Docker configuration for development
```

## 🔒 Security Features

- **Role-Based Authentication**: JWT-based authentication with three distinct roles (Operator, Admin, Super Admin)
- **Rate Limiting**: Configurable request rate limiting to prevent abuse
- **Input Validation**: Comprehensive Joi-based request validation for all endpoints
- **Security Headers**: Helmet.js security headers for protection against common attacks
- **Input Sanitization**: XSS and injection prevention on all user inputs
- **CORS Configuration**: Properly configured cross-origin resource sharing
- **File Upload Security**: Secure file upload with type validation and size limits
- **Data Encryption**: Sensitive data encryption at rest and in transit

## 🌍 Multilingual & Voice Support

### Voice Processing
- **Speech-to-Text**: Vosk offline processing for privacy and speed
- **Multiple Languages**: Support for local languages and dialects
- **Real-time Processing**: Live voice query processing with immediate feedback
- **Noise Reduction**: Built-in audio processing for industrial environments

### Local Language Support  
- **Text-to-Speech**: Coqui TTS for natural-sounding responses in local languages
- **Language Detection**: Automatic detection of operator's preferred language
- **Cultural Context**: Responses adapted to local industrial terminology and practices
- **Multilingual Interface**: UI supports multiple languages for global deployment

## 📊 Monitoring and Logging

- **Winston Logging**: Structured logging with multiple levels for different components
- **Query Analytics**: Track operator query patterns and response effectiveness  
- **Performance Monitoring**: Monitor AI processing times and system performance
- **Error Tracking**: Comprehensive error handling and tracking for debugging
- **Health Checks**: Built-in health monitoring endpoints for system status
- **Alert Management**: Real-time notification system with severity-based routing

## 🚀 Deployment

### Development Environment
```bash
# Start both frontend and backend in development mode
npm run dev

# Or start them separately
npm run server:dev  # Backend only
npm run client:dev  # Frontend only
```

### Production Build
```bash
# Build both frontend and backend for production
npm run build

# Start production server
npm run start

# Or build separately
npm run server:build  # Backend build
npm run client:build  # Frontend build
```

### Docker Deployment
```bash
# Build Docker image
docker build -t talktomachine:latest .

# Run with docker-compose (includes MongoDB and Redis)
docker-compose up -d

# Scale services
docker-compose up --scale server=3 --scale worker=2

# Stop and clean up
docker-compose down
```

### Production Environment Variables
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/talktomachine
FIREBASE_PROJECT_ID=your-production-project-id
REDIS_URL=redis://your-redis-instance:6379
# ... other production configurations
```

## 🤝 Contributing

We welcome contributions to improve TalkToMachine! Please follow these guidelines:

1. **Fork the repository** and create a feature branch
   ```bash
   git checkout -b feature/amazing-new-feature
   ```

2. **Follow coding standards**
   - Use TypeScript for all new code
   - Follow existing code style and conventions
   - Add comprehensive tests for new features
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm run test           # Run all tests
   npm run lint          # Check code style
   npm run type-check    # Verify TypeScript types
   ```

4. **Commit and push changes**
   ```bash
   git commit -m 'Add amazing new feature for operator voice queries'
   git push origin feature/amazing-new-feature
   ```

5. **Open a Pull Request** with detailed description of changes

### Development Guidelines
- **AI Components**: Test with sample data before integrating real AI models
- **Voice Processing**: Ensure offline capabilities for industrial environments
- **Security**: Always validate inputs and sanitize outputs
- **Performance**: Optimize for low-latency responses in industrial settings
- **Accessibility**: Ensure UI works well in noisy industrial environments

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

**TalkToMachine Development Team** - Currently working on this MVP to revolutionize industrial operations

- **Lead Developer**: [@Cyberpradeep](https://github.com/Cyberpradeep)
- **AI/ML Specialist**: Working on voice processing and intent classification
- **Frontend Developer**: Building responsive operator and admin interfaces  
- **Backend Developer**: Developing scalable API and database architecture
- **DevOps Engineer**: Setting up deployment and monitoring infrastructure

*We are actively developing this MVP and welcome collaboration from industrial automation experts, AI specialists, and full-stack developers.*

## 🙏 Acknowledgments

- **Industrial Automation Community** for providing domain expertise and feedback
- **Open Source AI Community** for excellent tools like Hugging Face and LangChain
- **Firebase Team** for robust authentication and messaging services
- **MongoDB Team** for scalable database solutions
- **React and Node.js Communities** for excellent development frameworks
- **Voice Processing Communities** working on Vosk and Coqui TTS
- **All beta testers** from MSME manufacturing units providing real-world feedback

## 📞 Support & Contact

For technical support, feature requests, or partnership inquiries:

- **Email**: pradeepnaveen930@gmail.com
- **GitHub Issues**: Create an issue in this repository for bug reports or feature requests
- **Documentation**: Check our [API documentation](docs/API.md) for integration details
- **Community**: Join our discussions for development updates and community support

## 🎯 Current Development Status

**MVP Status**: 🚧 **In Active Development** 🚧

### Completed Features ✅
- Basic authentication and user management system
- Database schemas and API structure
- Core backend framework with security middleware

### In Progress 🔄  
- Voice processing integration (Vosk + Coqui TTS)
- LangChain + FAISS manual search implementation
- Critical issue detection with NLP
- React frontend with Material UI
- Firebase notifications system

### Upcoming Features 🔮
- Multi-enterprise management
- Advanced analytics dashboard
- Mobile app development
- Offline voice processing capabilities
- Enterprise deployment guides

---

**🔧 Building the future of industrial communication - One voice query at a time! 🔧**

*Made with ❤️ for MSME machine operators worldwide*
