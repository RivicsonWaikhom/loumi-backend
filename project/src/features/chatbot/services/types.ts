export type ChatLanguage = 'en' | 'hi';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  district?: string;
  role: string;
}

export interface SourceCitation {
  document: string;
  page: number;
  heading: string;
  score: number;
}

export interface MessageMetadata {
  sources?: SourceCitation[];
  confidence?: string;
  in_scope?: boolean;
  image_url?: string;
  thumbnail_url?: string;
  image_filename?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  message_type: 'text' | 'image' | 'voice';
  metadata_json?: string;
  created_at: string;
  sources?: SourceCitation[];
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message_preview?: string | null;
}

export interface ConversationMessagesResponse {
  conversation: Conversation;
  messages: Message[];
  has_more: boolean;
  next_cursor?: string | null;
}

export interface ImageValidationResult {
  valid: boolean;
  filename: string;
  width: number;
  height: number;
  file_size_bytes: number;
  mime_type: string;
  thumbnail_url: string;
  message: string;
  future_integration_note: string;
}

export interface DiseaseSections {
  what_is_it: string;
  symptoms: string[];
  next_steps: string[];
  prevention: string[];
}

export interface DiseaseProbability {
  class: string;
  display_name: string;
  score: number;
  percent: string;
}

export interface DiseaseDiagnosisResult {
  valid?: boolean;
  is_valid_leaf?: boolean;
  disease_name: string;
  raw_class?: string | null;
  confidence: number;
  confidence_percent: string;
  status: 'diseased' | 'healthy' | 'invalid';
  is_healthy: boolean;
  caution: string;
  message?: string;
  category?: string;
  category_display?: string;
  category_scores?: Record<string, number>;
  validation?: any;
  sections?: DiseaseSections | null;
  summary_markdown: string;
  thumbnail_url: string;
  filename: string;
  probabilities: DiseaseProbability[];
  model_version?: string;
  width?: number;
  height?: number;
}
