import { API_ENDPOINTS } from "@/config/api";
import { getJson, postJson, postForm, deleteJson, ApiError } from "./apiClient";
import type {
  ChatbotRequest,
  ChatbotResponse,
  ActiveConversationResponse,
  ConversationListResponse,
  ChatDiagnosisResponse,
  AssociatePlantResponse,
  ChatMessage,
} from "@/types/chatbot";

export async function fetchActiveConversation(
  limit = 50,
  beforeTimestamp?: string
): Promise<ActiveConversationResponse> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (beforeTimestamp) params.set("before_timestamp", beforeTimestamp);
  const qs = params.toString();
  const url = qs ? `${API_ENDPOINTS.chatConversation}?${qs}` : API_ENDPOINTS.chatConversation;
  return await getJson<ActiveConversationResponse>(url);
}

export async function fetchConversationMessages(
  conversationId: string,
  limit = 50,
  beforeTimestamp?: string
): Promise<{
  messages: ChatMessage[];
  has_more: boolean;
  total_count: number;
  oldest_timestamp?: string;
}> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (beforeTimestamp) params.set("before_timestamp", beforeTimestamp);
  const qs = params.toString();
  const url = `${API_ENDPOINTS.chatConversations}/${conversationId}/messages${qs ? `?${qs}` : ""}`;
  return await getJson(url);
}

export async function fetchUserConversations(): Promise<ConversationListResponse> {
  return await getJson<ConversationListResponse>(API_ENDPOINTS.chatConversations);
}

export async function sendChatMessage(
  request: ChatbotRequest
): Promise<ChatbotResponse> {
  const url = request.conversation_id
    ? `${API_ENDPOINTS.chatConversations}/${request.conversation_id}/messages`
    : API_ENDPOINTS.chatbot;

  const response = await postJson<any, ChatbotResponse>(
    url,
    request,
    { timeoutMs: 45_000 }
  );

  const cleanReply = response?.reply?.trim();
  if (!cleanReply) {
    throw new ApiError(
      "The AI assistant returned an empty response. Please try asking again.",
      200,
      "empty_response"
    );
  }

  return {
    ...response,
    reply: cleanReply,
  };
}

export async function diagnoseLeafInChat(
  file: File,
  query?: string,
  language = "en",
  conversationId?: string
): Promise<ChatDiagnosisResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (query) {
    formData.append("query", query);
  }
  formData.append("language", language);

  const url = conversationId
    ? `${API_ENDPOINTS.chatConversations}/${conversationId}/diagnose`
    : API_ENDPOINTS.chatDiagnose;

  const response = await postForm<ChatDiagnosisResponse>(url, formData, {
    timeoutMs: 60_000,
  });

  return response;
}

export async function associatePlantDiagnosis(
  conversationId: string,
  messageId: string,
  farmId: string,
  plantId: string,
  notes?: string
): Promise<AssociatePlantResponse> {
  const url = `${API_ENDPOINTS.chatConversations}/${conversationId}/messages/${messageId}/associate-plant`;
  return await postJson<any, AssociatePlantResponse>(url, {
    farm_id: farmId,
    plant_id: plantId,
    notes,
  });
}

export async function clearChatConversation(
  conversationId?: string
): Promise<{ success: boolean; message: string }> {
  const url = conversationId
    ? `${API_ENDPOINTS.chatConversations}/${conversationId}`
    : API_ENDPOINTS.chatConversation;

  return await deleteJson<{ success: boolean; message: string }>(url);
}
