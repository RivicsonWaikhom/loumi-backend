import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { ChatbotView } from '@/features/chatbot';

/**
 * Loumi Chatbot Page
 * Hosts the modular agricultural AI assistant with:
 * - Deterministic, offline local BM25 RAG answering agricultural queries
 * - Full conversation session management & SQLite persistence
 * - Speech-to-text voice input and natural bilingual voice readouts (English & Hindi)
 * - 2-stage plant check modal (zero-shot CLIP validation + YOLOv8n disease detection)
 * - Seamless integration with Loumi website user sessions
 */
export default function Chatbot() {
  const { user } = useAuth();

  const mappedUser = user
    ? {
        id: user.id,
        username: user.email.split('@')[0],
        name: user.full_name || user.email.split('@')[0],
        email: user.email,
        role: 'farmer',
      }
    : undefined;

  return (
    <div className="w-full flex-1 flex flex-col bg-[#fcfbf7]">
      <ChatbotView
        user={mappedUser}
        className="h-[calc(100vh-4rem)] min-h-[640px]"
      />
    </div>
  );
}
