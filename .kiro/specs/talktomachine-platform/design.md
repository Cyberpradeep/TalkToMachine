# Design Document

## Overview

TalkToMachine is a full-stack MERN platform that provides AI-powered multilingual chat capabilities with comprehensive document management and admin dashboards. The system is built using Node.js/Express backend with MongoDB, React frontend, Firebase Auth, and local AI models for embeddings, STT, and TTS processing.

The architecture emphasizes offline-first AI capabilities using local models, multilingual support with Tanglish detection, and enterprise-grade features including role-based access control, real-time notifications, and comprehensive audit logging.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Admin   │    │   Mobile Apps   │    │  External APIs  │
│    Dashboard    │    │   (Future)      │    │   (Firebase)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │     Express API Server    │
                    │   (Node.js + TypeScript)  │
                    └─────────────┬─────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
┌─────────┴───────┐    ┌─────────┴───────┐    ┌─────────┴───────┐
│    MongoDB      │    │  Local AI Stack │    │ Firebase Admin  │
│   (Documents,   │    │ • Transformers  │    │ • Auth & FCM    │
│   Vectors,      │    │ • Vosk (STT)    │    │ • Push Notify   │
│   Logs)         │    │ • Piper (TTS)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Request Flow Architecture

```
Query Request → Auth Middleware → Rate Limiting → Query Pipeline
                                                       │
                                                       ▼
Audio Input → STT → Language Detection → Intent Classification
                                                       │
                                                       ▼
Risk Assessment → Block Check → Response Generation → TTS → Logging
                                                       │
                                                       ▼
Push Notifications ← Alert Creation ← High Risk Detection
```

## Components and Interfaces

### Backend Components

#### 1. Query Pipeline (`modules/query/pipeline.ts`)
- **Purpose**: Orchestrates the complete query processing workflow
- **Interfaces**:
  ```typescript
  interface QueryRequest {
    enterprise_id: string;
    operator_id: string;
    input_text?: string;
    audio_base64?: string;
    language?: string;
  }

  interface QueryResponse {
    text: string;
    steps?: ProcessingStep[];
    intent: IntentResult;
    risk_level: RiskLevel;
    blocked: boolean;
    audio_base64?: string;
    trace: ProcessingTrace;
  }
  ```

#### 2. Language Detection (`modules/query/language.ts`)
- **Purpose**: Detects language including Tanglish heuristics
- **Interfaces**:
  ```typescript
  interface LanguageDetectionResult {
    detected_language: string;
    confidence: number;
    is_tanglish: boolean;
    tamil_ratio: number;
  }
  ```

#### 3. Intent Classification (`modules/query/intent.ts`)
- **Purpose**: Classifies user intent using vector similarity
- **Interfaces**:
  ```typescript
  interface IntentResult {
    name: string;
    confidence: number;
    matched_examples: string[];
  }

  interface IntentConfig {
    name: string;
    examples: string[];
    responses: Record<string, string>;
    risk: RiskLevel;
    block_threshold?: RiskLevel;
  }
  ```

#### 4. Embeddings Service (`modules/query/embeddings.ts`)
- **Purpose**: Generates embeddings using local transformer models
- **Interfaces**:
  ```typescript
  interface EmbeddingService {
    embed(texts: string[]): Promise<number[][]>;
    similarity(embedding1: number[], embedding2: number[]): number;
    batchEmbed(texts: string[], batchSize?: number): Promise<number[][]>;
  }
  ```

#### 5. Document Ingestion (`modules/manuals/ingest.ts`)
- **Purpose**: Processes uploaded documents and creates searchable chunks
- **Interfaces**:
  ```typescript
  interface DocumentIngestionResult {
    documents_indexed: number;
    chunks_indexed: number;
    processing_time_ms: number;
  }

  interface DocumentChunk {
    text: string;
    order: number;
    metadata: ChunkMetadata;
  }
  ```

#### 6. STT/TTS Services (`modules/query/stt.ts`, `modules/query/tts.ts`)
- **Purpose**: Offline speech processing using local models
- **Interfaces**:
  ```typescript
  interface STTService {
    transcribe(audioBase64: string): Promise<string>;
    isReady(): boolean;
  }

  interface TTSService {
    synthesize(text: string, language: string): Promise<string>;
    getCachedAudio(key: string): string | null;
  }
  ```

### Frontend Components

#### 1. Admin Dashboard (`pages/Dashboard.tsx`)
- **Purpose**: Main admin interface with metrics and navigation
- **Features**: Query statistics, alert summaries, system health

#### 2. Query Management (`pages/Queries.tsx`)
- **Purpose**: View and manage query logs with filtering
- **Features**: Pagination, search, detailed view, deletion

#### 3. Alert Management (`pages/Alerts.tsx`)
- **Purpose**: Monitor and respond to high-risk queries
- **Features**: Real-time updates, priority sorting, bulk actions

#### 4. Document Upload (`pages/Upload.tsx`)
- **Purpose**: Upload and manage documents for semantic search
- **Features**: Drag-and-drop, progress tracking, validation

#### 5. Chat Interface (`pages/Chat.tsx`)
- **Purpose**: Test chat functionality with real-time responses
- **Features**: Audio input, language selection, response playback

## Data Models

### MongoDB Collections

#### 1. Enterprises
```typescript
interface Enterprise {
  _id: ObjectId;
  name: string;
  created_at: Date;
  settings?: {
    risk_threshold: RiskLevel;
    allowed_languages: string[];
    max_query_length: number;
  };
}
```

#### 2. Users
```typescript
interface User {
  _id: ObjectId;
  email: string;
  role: 'operator' | 'enterprise_admin' | 'super_admin';
  enterprises: ObjectId[];
  fcm_tokens: string[];
  created_at: Date;
  last_active?: Date;
}
```

#### 3. Queries
```typescript
interface Query {
  _id: ObjectId;
  enterprise_id: ObjectId;
  operator_id: ObjectId;
  data: {
    text: string;
    intent: IntentResult;
    confidence: number;
    risk: RiskLevel;
    blocked: boolean;
    detected_language: string;
    processing_time_ms: number;
    response_text?: string;
  };
  created_at: Date;
}
```

#### 4. Alerts
```typescript
interface Alert {
  _id: ObjectId;
  enterprise_id: ObjectId;
  operator_id: ObjectId;
  data: {
    text: string;
    intent: IntentResult;
    risk: RiskLevel;
    language: string;
    trigger_reason: string;
  };
  created_at: Date;
  acknowledged?: Date;
  acknowledged_by?: ObjectId;
}
```

#### 5. Manuals
```typescript
interface Manual {
  _id: ObjectId;
  enterprise_id: ObjectId;
  filename: string;
  original_name: string;
  size: number;
  mime_type: string;
  uploaded_at: Date;
  uploaded_by: ObjectId;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

#### 6. Chunks
```typescript
interface Chunk {
  _id: ObjectId;
  manual_id: ObjectId;
  enterprise_id: ObjectId;
  text: string;
  order: number;
  metadata: {
    page_number?: number;
    section_title?: string;
    word_count: number;
  };
}
```

#### 7. Vectors
```typescript
interface Vector {
  _id: ObjectId;
  enterprise_id: ObjectId;
  chunk_id: ObjectId;
  embedding: number[];
  model_version: string;
  created_at: Date;
}
```

## Error Handling

### Error Categories

1. **Validation Errors** (400)
   - Invalid request format
   - Missing required fields
   - File size/type violations

2. **Authentication Errors** (401/403)
   - Invalid Firebase tokens
   - Insufficient permissions
   - Role-based access violations

3. **Rate Limiting Errors** (429)
   - Query rate exceeded
   - Upload rate exceeded
   - Per-enterprise limits

4. **Processing Errors** (500)
   - STT/TTS service failures
   - Embedding generation failures
   - Database connection issues

5. **Service Unavailable** (503)
   - AI models not loaded
   - External service dependencies
   - Maintenance mode

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    trace_id: string;
  };
  timestamp: string;
}
```

### Recovery Strategies

- **Graceful Degradation**: Fallback to text-only responses when TTS fails
- **Retry Logic**: Exponential backoff for transient failures
- **Circuit Breaker**: Disable failing services temporarily
- **Fallback Models**: Use simpler models when primary models fail

## Testing Strategy

### Unit Testing

1. **Language Detection Tests**
   - Tanglish ratio calculations
   - Unicode character detection
   - Fallback library integration

2. **Intent Classification Tests**
   - Vector similarity calculations
   - Confidence score accuracy
   - Multi-language example matching

3. **Risk Assessment Tests**
   - Keyword-based escalation
   - Threshold-based blocking
   - Intent-to-risk mapping

4. **Document Processing Tests**
   - Text extraction accuracy
   - Chunking strategies
   - Embedding generation

### Integration Testing

1. **Query Pipeline Tests**
   - End-to-end text query processing
   - Audio query with STT/TTS
   - High-risk query blocking

2. **Document Upload Tests**
   - Multi-format file processing
   - Large file handling
   - Concurrent upload scenarios

3. **Admin Dashboard Tests**
   - Query log retrieval
   - Alert management
   - Real-time notifications

### Performance Testing

1. **Load Testing**
   - Concurrent query processing
   - Bulk document uploads
   - Database query optimization

2. **Memory Testing**
   - Model loading and caching
   - Vector storage efficiency
   - Memory leak detection

### Test Data and Fixtures

1. **Golden Test Cases**
   - Sample queries with expected intents
   - Risk assessment scenarios
   - Multi-language examples

2. **Mock Services**
   - Deterministic STT responses
   - Fake TTS audio generation
   - Firebase Auth simulation

### Continuous Integration

1. **Automated Testing**
   - Pre-commit hooks for linting
   - Pull request validation
   - Deployment smoke tests

2. **Test Coverage**
   - Minimum 80% code coverage
   - Critical path 100% coverage
   - Integration test coverage tracking

## Security Considerations

### Input Validation
- File type and size validation
- Audio format verification
- Text length limits
- SQL injection prevention

### Authentication & Authorization
- Firebase JWT validation
- Role-based access control
- Enterprise data isolation
- API key management

### Data Protection
- Sensitive data encryption
- Audit log integrity
- PII handling compliance
- Secure file storage

### Rate Limiting & DDoS Protection
- Per-enterprise rate limits
- IP-based throttling
- Request size limits
- Connection pooling

## Performance Optimization

### Caching Strategy
- TTS output caching (LRU)
- Embedding result caching
- Intent classification caching
- Static asset caching

### Database Optimization
- Vector search indexing
- Query result pagination
- Connection pooling
- Read replicas for analytics

### Model Optimization
- Lazy model loading
- Batch processing
- Memory-mapped models
- GPU acceleration (future)

### API Optimization
- Response compression
- Streaming responses
- Async processing
- Connection keep-alive