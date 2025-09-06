# Implementation Plan

- [x] 1. Set up project structure and core configuration




  - Create MERN project structure with TypeScript configuration
  - Set up Express server with basic middleware (CORS, body parser, error handling)
  - Configure MongoDB connection with Mongoose schemas
  - Create environment configuration and validation
  - Set up basic logging and health check endpoint
  - _Requirements: 6.4, 7.1_

- [x] 2. Implement authentication and authorization system















  - Set up Firebase Admin SDK integration for token validation
  - Create authentication middleware with dev mode bypass (ALLOW_NO_AUTH)
  - Implement role-based access control middleware
  - Create user registration and FCM token management endpoints
  - Write unit tests for authentication and authorization logic
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [x] 3. Create MongoDB data models and schemas












  - Implement Mongoose schemas for all collections (enterprises, users, queries, alerts, manuals, chunks, vectors)
  - Add validation rules and indexes for optimal query performance
  - Create database connection utilities and error handling
  - Write unit tests for model validation and database operations
  - _Requirements: 4.1, 4.2, 3.4, 3.5_

- [x] 4. Implement rate limiting and security middleware
















  - Create token bucket rate limiting for different endpoint categories
  - Implement request validation middleware for file uploads and API calls
  - Add security headers and CORS configuration
  - Create input sanitization utilities
  - Write unit tests for rate limiting and security features
  - _Requirements: 7.2, 7.3, 7.4_

- [x] 5. Build language detection and Tanglish identification





  - Implement Tamil Unicode character detection utilities
  - Create Tanglish ratio calculation algorithm
  - Integrate fallback language detection libraries (franc/cld3)
  - Build language detection service with confidence scoring
  - Write comprehensive unit tests for language detection scenarios
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 6. Create intent classification system
  - Implement YAML configuration loader for intents.yml
  - Build vector similarity calculation utilities for intent matching
  - Create intent classification service with confidence scoring
  - Implement multilingual intent example matching
  - Write unit tests for intent classification with golden test cases
  - _Requirements: 1.3, 5.4, 8.1_

- [ ] 7. Implement risk assessment and blocking logic
  - Create risk level mapping from intent configuration
  - Build keyword-based risk escalation system
  - Implement query blocking logic based on risk thresholds
  - Create alert generation for high-risk queries
  - Write unit tests for risk assessment scenarios
  - _Requirements: 1.4, 3.3, 8.1_

- [ ] 8. Build embeddings service with local transformers
  - Set up @xenova/transformers with all-MiniLM-L6-v2 model
  - Implement embedding generation service with batching support
  - Create cosine similarity utilities for vector search
  - Add embedding caching and optimization
  - Write unit tests for embedding generation and similarity calculations
  - _Requirements: 2.3, 2.5, 8.1_

- [ ] 9. Implement document processing and chunking
  - Create file upload validation for PDF/DOC/DOCX formats
  - Implement text extraction using pdf-parse and mammoth libraries
  - Build document chunking algorithm with configurable parameters
  - Create document ingestion pipeline with progress tracking
  - Write unit tests for document processing and chunking logic
  - _Requirements: 2.1, 2.2, 8.2_

- [ ] 10. Build vector storage and semantic search
  - Implement in-memory vector storage with enterprise isolation
  - Create semantic search functionality using cosine similarity
  - Build vector indexing and retrieval optimizations
  - Add vector storage management utilities
  - Write unit tests for vector operations and search accuracy
  - _Requirements: 2.4, 2.5_

- [ ] 11. Create STT service with Vosk integration
  - Set up Vosk model download and initialization scripts
  - Implement audio processing and transcription service
  - Create audio format validation and conversion utilities
  - Add STT service caching and error handling
  - Write unit tests with mock audio inputs and deterministic outputs
  - _Requirements: 1.2, 8.4_

- [ ] 12. Implement TTS service with Piper integration
  - Set up Piper TTS model download and configuration
  - Create text-to-speech synthesis service with language mapping
  - Implement TTS output caching with LRU strategy
  - Add Tanglish to Tamil voice mapping for TTS
  - Write unit tests for TTS synthesis and caching
  - _Requirements: 1.5, 5.3, 7.5_

- [ ] 13. Build complete query processing pipeline
  - Integrate all services into unified query processing pipeline
  - Implement audio-to-text conversion flow
  - Create response generation with multilingual support
  - Add text-to-audio conversion for responses
  - Write integration tests for complete query processing workflows
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 14. Implement query and alert logging system
  - Create query logging service with metadata capture
  - Implement alert creation for blocked high-risk queries
  - Build audit trail functionality for all query interactions
  - Add log retention and cleanup utilities
  - Write unit tests for logging and alert generation
  - _Requirements: 1.6, 3.3_

- [ ] 15. Create push notification system
  - Set up Firebase Cloud Messaging integration
  - Implement FCM token registration and management
  - Create notification service for admin alerts
  - Build notification templates for different alert types
  - Write unit tests for notification delivery logic
  - _Requirements: 3.6, 6.5_

- [ ] 16. Build admin query management endpoints
  - Create GET /admin/:enterprise_id/queries endpoint with pagination
  - Implement query filtering and search functionality
  - Create DELETE /admin/:enterprise_id/queries/:id endpoint
  - Add query detail retrieval with full metadata
  - Write integration tests for query management endpoints
  - _Requirements: 3.1, 3.2, 3.5_

- [ ] 17. Implement admin alert management endpoints
  - Create GET /admin/:enterprise_id/alerts endpoint with pagination
  - Implement alert filtering and priority sorting
  - Create DELETE /admin/:enterprise_id/alerts/:id endpoint
  - Add alert acknowledgment functionality
  - Write integration tests for alert management endpoints
  - _Requirements: 3.4, 3.5_

- [ ] 18. Create document upload and management endpoints
  - Implement POST /upload/manual endpoint with multipart file handling
  - Add document validation and processing pipeline integration
  - Create document listing and management endpoints
  - Build upload progress tracking and status reporting
  - Write integration tests for document upload workflows
  - _Requirements: 2.1, 2.2, 2.6, 8.2_

- [ ] 19. Build super admin management endpoints
  - Create POST /super/create_enterprise endpoint
  - Implement POST /super/assign_admin endpoint with role validation
  - Add enterprise management and user assignment logic
  - Create audit logging for administrative actions
  - Write integration tests for super admin functionality
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 20. Implement main query processing endpoint
  - Create POST /query endpoint with comprehensive request handling
  - Integrate complete processing pipeline (STT → language detection → intent → risk → response → TTS)
  - Add query logging and alert generation
  - Implement push notification triggers for high-risk queries
  - Write comprehensive integration tests for query endpoint
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 21. Create health monitoring and metrics endpoints
  - Implement GET /health endpoint with service status checks
  - Add service health monitoring for all AI components
  - Create system metrics collection and reporting
  - Build service dependency health validation
  - Write unit tests for health check functionality
  - _Requirements: 7.1_

- [ ] 22. Set up OpenAPI documentation and client generation
  - Create OpenAPI specification using swagger-jsdoc
  - Set up /docs endpoint with Swagger UI
  - Generate TypeScript client for frontend consumption
  - Add API documentation for all endpoints
  - Write scripts for automatic client generation
  - _Requirements: 8.3, 8.4_

- [ ] 23. Build React admin dashboard foundation
  - Set up React TypeScript project with Vite
  - Create routing structure and navigation components
  - Implement authentication integration with Firebase
  - Set up API client integration with generated TypeScript client
  - Create basic layout and navigation components
  - _Requirements: 3.1, 6.1_

- [ ] 24. Implement admin dashboard pages
  - Create Dashboard page with metrics and system overview
  - Build Queries page with listing, filtering, and detail views
  - Implement Alerts page with real-time updates and management
  - Create Upload page with drag-and-drop document upload
  - Add Chat page for testing query functionality
  - _Requirements: 3.1, 3.2, 3.4, 2.1_

- [ ] 25. Add real-time features and notifications
  - Implement WebSocket or Server-Sent Events for real-time updates
  - Create real-time alert notifications in admin dashboard
  - Add live query monitoring and status updates
  - Implement push notification handling in frontend
  - Write integration tests for real-time functionality
  - _Requirements: 3.6_

- [ ] 26. Create model download and initialization scripts
  - Build download-models.ts script for Vosk and Piper models
  - Create model initialization and validation utilities
  - Add model version management and updates
  - Implement lazy loading for AI models
  - Write scripts for model management and cleanup
  - _Requirements: 8.1, 8.4_

- [ ] 27. Implement comprehensive testing suite
  - Create golden test fixtures for intent classification and risk assessment
  - Build integration test suite for all API endpoints
  - Add performance tests for query processing pipeline
  - Create end-to-end tests for complete user workflows
  - Set up test coverage reporting and CI integration
  - _Requirements: 8.1, 8.2, 8.5_

- [ ] 28. Add Docker containerization and deployment
  - Create Dockerfile for Node.js backend application
  - Set up docker-compose.yml with MongoDB and application services
  - Add production environment configuration
  - Create deployment scripts and health checks
  - Write documentation for deployment and scaling
  - _Requirements: 8.4_

- [ ] 29. Create configuration and sample data
  - Build comprehensive intents.yml with multilingual examples
  - Create .env.example files for server and frontend
  - Add sample test data and fixtures
  - Create setup and initialization scripts
  - Write comprehensive README with setup instructions
  - _Requirements: 5.4, 8.4_

- [ ] 30. Final integration and optimization
  - Integrate all components and test complete system workflows
  - Optimize performance bottlenecks and memory usage
  - Add production logging and monitoring
  - Create system administration utilities
  - Perform final testing and documentation review
  - _Requirements: 7.5, 8.1, 8.2_