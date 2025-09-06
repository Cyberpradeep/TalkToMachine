// Core type definitions for the TalkToMachine platform

export interface QueryRequest {
  enterprise_id: string;
  operator_id: string;
  input_text?: string;
  audio_base64?: string;
  language?: string;
}

export interface QueryResponse {
  text: string;
  steps?: ProcessingStep[];
  intent: IntentResult;
  risk_level: RiskLevel;
  blocked: boolean;
  audio_base64?: string;
  trace: ProcessingTrace;
}

export interface ProcessingStep {
  name: string;
  duration_ms: number;
  success: boolean;
  error?: string;
}

export interface IntentResult {
  name: string;
  confidence: number;
  matched_examples: string[];
}

export interface ProcessingTrace {
  trace_id: string;
  timestamp: Date;
  processing_time_ms: number;
  steps: ProcessingStep[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type UserRole = 'operator' | 'enterprise_admin' | 'super_admin';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    trace_id: string;
  };
  timestamp: string;
}