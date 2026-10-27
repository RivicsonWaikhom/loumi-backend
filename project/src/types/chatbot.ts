export type ChatLanguage = "en" | "hi";

export interface DiagnosisMetadata {
  is_valid_leaf?: boolean;
  top_class?: string;
  display_name?: string;
  score?: number;
  percentage?: number;
  classification?: "healthy" | "diseased" | "uncertain";
  ranked_classes?: Array<{
    className: string;
    displayName: string;
    score: number;
    percentage: number;
  }>;
  symptoms?: string[];
  next_steps?: string[];
  prevention?: string[];
  thumbnail?: string;
  image_url?: string;
  filename?: string;
  validation?: {
    category?: string;
    is_valid_leaf?: boolean;
    confidence?: number;
    message?: string;
  };
}

export interface ChatMessage {
  id: string;
  conversation_id?: string;
  role: "user" | "assistant";
  content: string;
  message_type?: "text" | "image_query" | "diagnosis" | "diagnosis_rejected";
  metadata?: DiagnosisMetadata;
  language?: ChatLanguage;
  timestamp: string;
  sources?: string[];
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationSummary {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_preview?: string;
  last_message_time?: string;
  message_count?: number;
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
}

export interface ActiveConversationResponse {
  conversation: ChatConversation;
  messages: ChatMessage[];
  has_more?: boolean;
  total_count?: number;
  oldest_timestamp?: string;
}

export interface ChatbotRequest {
  message: string;
  language: ChatLanguage;
  history?: { role: "user" | "assistant"; content: string }[];
  conversation_id?: string;
}

export interface ChatbotResponse {
  reply: string;
  answer?: string;
  language?: ChatLanguage;
  sources?: string[];
  citations?: any[];
  conversation_id?: string;
}

export interface ChatDiagnosisResponse {
  reply: string;
  answer?: string;
  is_valid_leaf: boolean;
  diagnosis?: DiagnosisMetadata | null;
  validation?: any;
  conversation_id?: string;
  language?: ChatLanguage;
}

export interface AssociatePlantResponse {
  success: boolean;
  message: string;
  observation?: any;
}
