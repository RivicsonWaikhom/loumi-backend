import {
  User,
  Conversation,
  ConversationMessagesResponse,
  Message,
  ImageValidationResult,
  DiseaseDiagnosisResult,
  ChatLanguage,
} from './types';

// Support VITE_CHATBOT_API_URL or relative proxying
const CHATBOT_BASE = import.meta.env.VITE_CHATBOT_API_URL
  ? (import.meta.env.VITE_CHATBOT_API_URL as string).replace(/\/+$/, '')
  : '';

export const API_BASE = `${CHATBOT_BASE}/api`;

const authUrl = (endpoint: string): string => {
  if (CHATBOT_BASE) {
    return `${CHATBOT_BASE}/api/auth/${endpoint}`;
  }
  return `/api/chatbot-auth/${endpoint}`;
};

const DEFAULT_TIMEOUT_MS = 25000;

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your network connection and try again.');
    }
    throw err;
  }
}

export function getStoredToken(): string | null {
  return (
    localStorage.getItem('loumi_standalone_token') ||
    localStorage.getItem('loumi_token') ||
    localStorage.getItem('token')
  );
}

export function setStoredToken(token: string): void {
  localStorage.setItem('loumi_standalone_token', token);
}

export function getStoredUser(): User | null {
  const raw =
    localStorage.getItem('loumi_standalone_user') ||
    localStorage.getItem('loumi_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem('loumi_standalone_user', JSON.stringify(user));
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetchWithTimeout(authUrl('users'));
  if (!res.ok) throw new Error('Failed to load dev users');
  return res.json();
}

export async function loginUser(userId: string): Promise<{ token: string; user: User }> {
  const res = await fetchWithTimeout(authUrl('login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to authenticate');
  }
  const data = await res.json();
  setStoredToken(data.access_token);
  setStoredUser(data.user);
  return { token: data.access_token, user: data.user };
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetchWithTimeout(`${API_BASE}/conversations`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch conversations');
  }
  return res.json();
}

export async function createConversation(title?: string): Promise<Conversation> {
  const res = await fetchWithTimeout(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ title: title || 'New Conversation' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create conversation');
  }
  return res.json();
}

export async function deleteConversation(convId: string): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/conversations/${convId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete conversation');
  }
}

export async function fetchMessages(
  convId: string,
  limit = 50,
  beforeTimestamp?: string
): Promise<ConversationMessagesResponse> {
  let url = `${API_BASE}/conversations/${convId}/messages?limit=${limit}`;
  if (beforeTimestamp) {
    url += `&before_timestamp=${encodeURIComponent(beforeTimestamp)}`;
  }
  const res = await fetchWithTimeout(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch messages');
  }
  return res.json();
}

export async function postMessage(
  convId: string,
  content: string,
  messageType = 'text',
  metadataJson?: string,
  language: ChatLanguage = 'en'
): Promise<Message> {
  const res = await fetchWithTimeout(`${API_BASE}/conversations/${convId}/messages`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      content,
      message_type: messageType,
      metadata_json: metadataJson,
      language,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to send message');
  }
  return res.json();
}

export async function uploadAndValidateImage(file: File): Promise<ImageValidationResult> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append('file', file);

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetchWithTimeout(`${API_BASE}/images/validate`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Image validation failed');
  }
  return res.json();
}

export async function diagnosePlantImage(file: File): Promise<DiseaseDiagnosisResult> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append('file', file);

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetchWithTimeout(
    `${API_BASE}/images/diagnose`,
    {
      method: 'POST',
      headers,
      body: formData,
    },
    45000
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Disease diagnosis failed. Please check file format.');
  }
  return res.json();
}

export async function saveDiagnosisToConversation(
  convId: string,
  userNote: string,
  summaryMarkdown: string,
  thumbnailUrl?: string,
  diagnosisMetadata?: any,
  language: ChatLanguage = 'en'
): Promise<Message[]> {
  const res = await fetchWithTimeout(`${API_BASE}/conversations/${convId}/diagnosis`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      user_note: userNote,
      summary_markdown: summaryMarkdown,
      thumbnail_url: thumbnailUrl,
      diagnosis_metadata: diagnosisMetadata,
      language,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save diagnosis to chat session');
  }
  return res.json();
}

export async function checkHealth(): Promise<{ status: string; knowledge_base: any }> {
  const res = await fetchWithTimeout(`${CHATBOT_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}
