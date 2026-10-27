import { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Send,
  RotateCcw,
  Bot,
  User as UserIcon,
  Languages,
  PlugZap,
  BookOpen,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Sparkles,
  Paperclip,
  Image as ImageIcon,
  X,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Activity,
  ChevronUp,
  Link as LinkIcon,
  CheckCheck,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ErrorMessage from '@/components/ErrorMessage';
import MarkdownView from '@/components/MarkdownView';
import { useAuth } from '@/context/AuthContext';
import {
  sendChatMessage,
  diagnoseLeafInChat,
  fetchActiveConversation,
  fetchConversationMessages,
  associatePlantDiagnosis,
  clearChatConversation,
} from '@/services/chatbotService';
import { fetchUserFarms } from '@/services/farmPlannerService';
import type { Farm } from '@/pages/farm-planner/types';
import { ApiError } from '@/services/apiClient';
import type {
  ChatMessage,
  ChatLanguage,
  DiagnosisMetadata,
} from '@/types/chatbot';

const suggestedQuestions: Record<ChatLanguage, string[]> = {
  en: [
    'How do I grow pineapples in acidic soil in Manipur?',
    'What are the symptoms and treatment for pineapple leaf blight?',
    'When is the best season to plant pineapples and rice?',
    'How can I improve pineapple soil drainage & yield?',
  ],
  hi: [
    'मणिपुर की अम्लीय मिट्टी में अनानास कैसे उगाएं?',
    'अनानास के पत्ती झुलसा (लीफ ब्लाइट) रोग के लक्षण और उपचार क्या हैं?',
    'अनानास और धान लगाने का सबसे अच्छा मौसम कौन सा है?',
    'अनानास के लिए मिट्टी की जल निकासी और पैदावार कैसे सुधारें?',
  ],
};

const welcomeMessage: Record<ChatLanguage, string> = {
  en: "Namaste! I'm your Loumi Pineapple & Rice Farming Assistant. Ask me anything about planting, soil preparation, disease prevention, fertilizers, or harvest. You can also upload a pineapple leaf photo directly here for instant disease diagnosis!",
  hi: 'नमस्ते! मैं आपका लौमी अनानास और धान कृषि सहायक हूँ। रोपाई, मिट्टी की तैयारी, रोग नियंत्रण, उर्वरक या कटाई के बारे में कोई भी प्रश्न पूछें। आप त्वरित रोग निदान के लिए यहां सीधे अनानास के पत्ते की तस्वीर भी अपलोड कर सकते हैं!',
};

const langLabel: Record<ChatLanguage, string> = { en: 'English', hi: 'हिन्दी' };

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatMessageTime(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

export default function Chatbot() {
  const { user, isAuthenticated } = useAuth();
  const [language, setLanguage] = useState<ChatLanguage>('en');
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Associate plant modal state
  const [associateModal, setAssociateModal] = useState<{
    open: boolean;
    messageId: string;
    condition: string;
  } | null>(null);
  const [userFarms, setUserFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [associationSaving, setAssociationSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedUserRef = useRef<string | null>(null);
  const loadingHistoryRef = useRef(false);

  // Load persistent conversation history once per authenticated user (deduplicated)
  useEffect(() => {
    let mounted = true;

    async function loadHistory() {
      if (!isAuthenticated || !user?.id) {
        setConversationId(undefined);
        setMessages([]);
        loadedUserRef.current = null;
        return;
      }

      // Avoid duplicate requests if already loaded for this user
      if (loadedUserRef.current === user.id || loadingHistoryRef.current) {
        return;
      }

      loadingHistoryRef.current = true;
      setIsLoadingHistory(true);

      try {
        const res = await fetchActiveConversation(50);
        if (mounted && res?.conversation) {
          setConversationId(res.conversation.id);
          loadedUserRef.current = user.id;
          if (res.messages && Array.isArray(res.messages)) {
            setMessages(res.messages);
            setHasMore(Boolean(res.has_more));
            setOldestTimestamp(res.oldest_timestamp || (res.messages[0]?.timestamp ?? null));
          }
        }
      } catch (err) {
        console.warn('[Chatbot] Could not load saved conversation history:', err);
      } finally {
        if (mounted) {
          setIsLoadingHistory(false);
          loadingHistoryRef.current = false;
        }
      }
    }

    loadHistory();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isTyping, imagePreviewUrl]);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const loadOlderMessages = async () => {
    if (!conversationId || isLoadingOlder || !oldestTimestamp) return;
    setIsLoadingOlder(true);
    try {
      const res = await fetchConversationMessages(conversationId, 30, oldestTimestamp);
      if (res?.messages && res.messages.length > 0) {
        setMessages((prev) => [...res.messages, ...prev]);
        setHasMore(Boolean(res.has_more));
        setOldestTimestamp(res.oldest_timestamp || (res.messages[0]?.timestamp ?? null));
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.warn('Failed to load older messages:', e);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 15 MB limit. Please select a smaller photo.');
      return;
    }

    setErrorMsg(null);
    setSelectedImage(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreviewUrl(objectUrl);
  };

  const removeSelectedImage = () => {
    if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImage(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const reset = async () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setErrorMsg(null);
    setShowClearConfirm(false);
    removeSelectedImage();

    if (isAuthenticated) {
      try {
        await clearChatConversation(conversationId);
      } catch (e) {
        console.error('[Chatbot] Failed to clear conversation on server:', e);
      }
    }
    setMessages([]);
    setHasMore(false);
    setOldestTimestamp(null);
    setInput('');
    setUnavailable(false);
    setIsTyping(false);
  };

  const switchLanguage = (lang: ChatLanguage) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setLanguage(lang);
    setErrorMsg(null);
  };

  const handleChatError = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 503) {
        setUnavailable(true);
        setErrorMsg('The AI chatbot provider is temporarily busy or unavailable. Please try again shortly.');
      } else if (err.code === 'network_error' || err.status === 0) {
        setUnavailable(true);
        setErrorMsg('Cannot reach the Loumi backend server. Make sure the backend is running on http://localhost:8000.');
      } else {
        setErrorMsg(err.message || 'Chat request failed.');
      }
    } else {
      setErrorMsg('Chat failed unexpectedly. Please check your network connection.');
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && !selectedImage) || isTyping) return;
    setErrorMsg(null);

    // Case 1: Image diagnosis upload
    if (selectedImage) {
      const imgFile = selectedImage;
      const previewSnapshot = imagePreviewUrl;
      removeSelectedImage();

      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        content: trimmed || (language === 'hi' ? 'अनानास पत्ती रोग निदान के लिए तस्वीर अपलोड की गई।' : `Uploaded pineapple leaf photograph for disease diagnosis (${imgFile.name}).`),
        message_type: 'image_query',
        metadata: {
          thumbnail: previewSnapshot || undefined,
          filename: imgFile.name,
        },
        language,
        timestamp: new Date().toISOString(),
      };

      setMessages((m) => [...m, userMsg]);
      setInput('');
      setIsTyping(true);

      try {
        const res = await diagnoseLeafInChat(imgFile, trimmed || undefined, language, conversationId);
        if (res.conversation_id && !conversationId) {
          setConversationId(res.conversation_id);
        }

        const botMsg: ChatMessage = {
          id: uid(),
          role: 'assistant',
          content: res.reply || res.answer || '',
          message_type: res.is_valid_leaf ? 'diagnosis' : 'diagnosis_rejected',
          metadata: res.diagnosis || { validation: res.validation },
          language: res.language ?? language,
          timestamp: new Date().toISOString(),
        };

        setMessages((m) => [...m, botMsg]);
        setUnavailable(false);
      } catch (err) {
        handleChatError(err);
      } finally {
        setIsTyping(false);
      }
      return;
    }

    // Case 2: Standard text message
    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: trimmed,
      message_type: 'text',
      language,
      timestamp: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setIsTyping(true);

    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await sendChatMessage({
        message: trimmed,
        language,
        history,
        conversation_id: conversationId,
      });

      if (res.conversation_id && !conversationId) {
        setConversationId(res.conversation_id);
      }

      const botMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: res.reply,
        message_type: 'text',
        language: res.language ?? language,
        timestamp: new Date().toISOString(),
        sources: res.sources,
      };
      setMessages((m) => [...m, botMsg]);
      setUnavailable(false);
    } catch (err) {
      handleChatError(err);
    } finally {
      setIsTyping(false);
    }
  };

  const retryLast = async () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg || isTyping) return;
    setErrorMsg(null);
    send(lastUserMsg.content);
  };

  // Open farm plant association modal
  const handleOpenAssociateModal = async (msgId: string, condition: string) => {
    setAssociateModal({ open: true, messageId: msgId, condition });
    try {
      const farms = await fetchUserFarms();
      setUserFarms(farms);
      if (farms.length > 0) {
        setSelectedFarmId(farms[0].id);
        const plants = farms[0].plants || [];
        if (plants.length > 0) {
          setSelectedPlantId(plants[0].id);
        }
      }
    } catch (e) {
      console.warn('Failed to load user farms for diagnosis association:', e);
    }
  };

  const handleConfirmAssociation = async () => {
    if (!conversationId || !associateModal || !selectedFarmId || !selectedPlantId) return;
    setAssociationSaving(true);
    try {
      const res = await associatePlantDiagnosis(
        conversationId,
        associateModal.messageId,
        selectedFarmId,
        selectedPlantId,
        `Diagnosed condition: ${associateModal.condition}`
      );
      setToastMsg(res.message);
      setAssociateModal(null);
      setTimeout(() => setToastMsg(null), 4000);
    } catch (e) {
      console.error('Failed to link diagnosis to plant:', e);
      setErrorMsg('Could not associate diagnosis with plant. Please ensure you own the selected farm.');
    } finally {
      setAssociationSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-forest-50/40 pb-16">
      <PageHeader
        icon={MessageSquare}
        eyebrow="AI Agronomist"
        title="Pineapple & Rice Farming Chatbot"
        description="Ask questions about pineapple and rice cultivation, diagnose leaf diseases from photos, and get verified agronomic advice in English or Hindi."
      >
        <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white p-1.5 shadow-xs">
          <Languages className="ml-2 h-4 w-4 text-forest-600" />
          {(Object.keys(langLabel) as ChatLanguage[]).map((lang) => (
            <button
              key={lang}
              onClick={() => switchLanguage(lang)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition cursor-pointer ${
                language === lang
                  ? 'bg-forest-700 text-white shadow-xs'
                  : 'text-forest-700 hover:bg-forest-100/70'
              }`}
            >
              {langLabel[lang]}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 mt-6">
        {toastMsg && (
          <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-900 shadow-xs flex items-center justify-between animate-fade-in">
            <span className="flex items-center gap-2">
              <CheckCheck className="h-4 w-4 text-emerald-700" />
              <span>{toastMsg}</span>
            </span>
            <button onClick={() => setToastMsg(null)} className="text-emerald-700 hover:text-emerald-950">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex h-[76vh] min-h-[600px] flex-col overflow-hidden rounded-2xl border border-forest-100 bg-white shadow-card">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-forest-100 bg-forest-50/70 px-5 py-3.5 backdrop-blur-xs">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-forest-700 text-white shadow-xs">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-sm font-bold text-forest-950">
                    Loumi Assistant
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    <Sparkles className="h-2.5 w-2.5 text-emerald-600" /> AI Agronomist + Disease Vision
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-forest-600">
                  <span>{langLabel[language]} &bull; Verified agricultural knowledge</span>
                  {isAuthenticated ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      &bull; <CheckCircle2 className="h-3 w-3" /> Saved to account
                    </span>
                  ) : (
                    <span className="text-gray-400">
                      &bull; Guest mode (Log in to sync history)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Clear conversation with confirmation */}
            {messages.length > 0 && (
              <div>
                {showClearConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-forest-800">Clear chat?</span>
                    <button
                      onClick={reset}
                      className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700 cursor-pointer"
                    >
                      Yes, clear
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="rounded-full bg-forest-100 px-3 py-1 text-xs font-medium text-forest-700 transition hover:bg-forest-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-forest-600 transition hover:bg-forest-100 cursor-pointer"
                    title="Clear current conversation"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Clear Chat
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Messages Scroll Area */}
          <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6 bg-[#fbfdfa]">
            {/* Load Older Messages Cursor Button */}
            {hasMore && (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  onClick={loadOlderMessages}
                  disabled={isLoadingOlder}
                  className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-4 py-1.5 text-xs font-semibold text-forest-700 shadow-2xs hover:bg-forest-50 transition disabled:opacity-50 cursor-pointer"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span>{isLoadingOlder ? 'Loading older history…' : 'Load earlier messages'}</span>
                </button>
              </div>
            )}

            {isLoadingHistory && (
              <div className="flex items-center justify-center py-6 text-xs text-forest-600 gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-forest-600 border-t-transparent" />
                <span>Restoring conversation history…</span>
              </div>
            )}

            {/* Empty State / Welcome Screen */}
            {!isLoadingHistory && messages.length === 0 && (
              <div className="space-y-6 max-w-3xl mx-auto py-2">
                <AssistantBubble
                  content={welcomeMessage[language]}
                  timestamp={new Date().toISOString()}
                  language={language}
                />

                <div className="rounded-2xl border border-forest-100 bg-white p-5 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-forest-600">
                    <Sparkles className="h-3.5 w-3.5 text-pineapple-600" />
                    <span>Suggested Questions to Ask</span>
                  </div>
                  <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {suggestedQuestions[language].map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        disabled={isTyping}
                        className="group flex items-start text-left rounded-xl border border-forest-200/80 bg-forest-50/40 p-3 text-xs sm:text-sm font-medium text-forest-900 transition hover:border-forest-400 hover:bg-forest-50 hover:shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <span className="text-forest-400 group-hover:text-forest-700 mr-2 shrink-0 font-bold">
                          &rarr;
                        </span>
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-forest-100 flex items-center justify-between text-xs text-forest-600">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4 text-emerald-700" />
                      <span><strong>Photo diagnosis:</strong> Click the paperclip icon below to upload a pineapple leaf.</span>
                    </span>
                  </div>
                </div>

                {unavailable && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                    <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    <div className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                      <p className="font-semibold text-amber-950">Chatbot Service Notice</p>
                      <p className="mt-1">
                        The AI service is running in local offline mode. Questions are answered directly from verified agricultural documents.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rendered Conversation Messages */}
            {messages.map((m) =>
              m.role === 'assistant' ? (
                <AssistantBubble
                  key={m.id}
                  id={m.id}
                  content={m.content}
                  messageType={m.message_type}
                  metadata={m.metadata}
                  sources={m.sources}
                  timestamp={m.timestamp}
                  language={m.language}
                  isAuthenticated={isAuthenticated}
                  onAssociatePlant={handleOpenAssociateModal}
                />
              ) : (
                <UserBubble
                  key={m.id}
                  content={m.content}
                  metadata={m.metadata}
                  timestamp={m.timestamp}
                />
              )
            )}

            {/* Error Message with Retry */}
            {errorMsg && (
              <div className="max-w-2xl mx-auto px-1">
                <ErrorMessage
                  title="Message failed"
                  message={errorMsg}
                  onRetry={retryLast}
                />
              </div>
            )}

            {/* Typing / Thinking Indicator */}
            {isTyping && (
              <div className="flex items-start gap-3 w-full" role="status" aria-label="Assistant is analyzing">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-700 text-white shadow-xs mt-0.5">
                  <Bot className="h-5 w-5" />
                </span>
                <div className="rounded-2xl border border-forest-100 bg-white px-5 py-4 shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-forest-600 mr-2">
                      {selectedImage ? 'Validating leaf image and analyzing disease…' : 'Consulting agricultural guides…'}
                    </span>
                    <span className="typing-dot h-2 w-2 rounded-full bg-forest-500" style={{ animationDelay: '0s' }} />
                    <span className="typing-dot h-2 w-2 rounded-full bg-forest-500" style={{ animationDelay: '0.15s' }} />
                    <span className="typing-dot h-2 w-2 rounded-full bg-forest-500" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Chat Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-forest-100 bg-white p-3.5 sm:p-4"
          >
            {/* Image Preview Chip if attached */}
            {imagePreviewUrl && selectedImage && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 p-2 sm:px-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={imagePreviewUrl}
                    alt="Upload preview"
                    className="h-10 w-10 shrink-0 rounded-lg object-cover border border-emerald-300"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-emerald-950 truncate">{selectedImage.name}</p>
                    <p className="text-[11px] text-emerald-700">
                      {(selectedImage.size / 1024).toFixed(1)} KB &bull; Pineapple leaf ready for diagnosis
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                  title="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageSelect}
              className="hidden"
            />

            <div className="flex items-end gap-2">
              {/* Attach Image Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isTyping}
                title="Attach pineapple leaf photo for disease diagnosis"
                className="inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-forest-200 bg-forest-50/50 text-forest-700 shadow-xs transition hover:bg-forest-100 hover:border-forest-300 disabled:opacity-40 cursor-pointer"
                aria-label="Upload leaf image"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              <textarea
                value={input}
                disabled={isTyping}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder={
                  selectedImage
                    ? language === 'hi'
                      ? 'इस पत्ती के बारे में कोई प्रश्न लिखें, या निदान के लिए भेजें पर क्लिक करें…'
                      : 'Add notes about this leaf (optional), then press Send to diagnose…'
                    : language === 'hi'
                    ? 'अनानास या धान की खेती, रोग या रोपाई के बारे में पूछें… (Enter दबाएँ)'
                    : 'Ask about pineapple or rice cultivation, or attach a leaf photo…'
                }
                aria-label="Type your message"
                className="max-h-36 min-h-[46px] flex-1 resize-none rounded-xl border border-forest-200 bg-forest-50/30 px-4 py-3 text-sm text-forest-950 placeholder:text-forest-400 focus:border-forest-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-200 disabled:bg-forest-100/50 disabled:text-forest-400 leading-relaxed"
              />

              <button
                type="submit"
                disabled={(!input.trim() && !selectedImage) || isTyping}
                className="inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-forest-700 text-white shadow-xs transition hover:bg-forest-800 disabled:opacity-40 disabled:hover:bg-forest-700 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-forest-500 px-1">
              <span>Press <strong>Enter</strong> to send &bull; <strong>Shift+Enter</strong> for newline</span>
              <span>Grounded in verified guidebooks &bull; YOLOv8n Vision</span>
            </div>
          </form>
        </div>
      </div>

      {/* Optional Plant Association Modal */}
      {associateModal && associateModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-forest-100 animate-scale-in">
            <div className="flex items-center justify-between border-b border-forest-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <LinkIcon className="h-4 w-4" />
                </span>
                <h3 className="font-display text-base font-bold text-forest-950">
                  Link Diagnosis to Farm Plant
                </h3>
              </div>
              <button
                onClick={() => setAssociateModal(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-forest-50 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <p className="text-forest-700">
                Associate this verified diagnosis (<strong>{associateModal.condition}</strong>) with a specific plant in your Farm Planner to track health observations over time.
              </p>

              <div>
                <label className="font-semibold text-forest-800 block mb-1">Select Farm</label>
                <select
                  value={selectedFarmId}
                  onChange={(e) => {
                    setSelectedFarmId(e.target.value);
                    const f = userFarms.find((x) => x.id === e.target.value);
                    if (f && f.plants && f.plants.length > 0) {
                      setSelectedPlantId(f.plants[0].id);
                    }
                  }}
                  className="w-full rounded-xl border border-forest-200 bg-forest-50/30 p-2.5 text-forest-900 focus:border-forest-500 focus:outline-none"
                >
                  {userFarms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.plants?.length || 0} plants)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-forest-800 block mb-1">Select Plant ID</label>
                <select
                  value={selectedPlantId}
                  onChange={(e) => setSelectedPlantId(e.target.value)}
                  className="w-full rounded-xl border border-forest-200 bg-forest-50/30 p-2.5 text-forest-900 focus:border-forest-500 focus:outline-none"
                >
                  {(userFarms.find((f) => f.id === selectedFarmId)?.plants || []).slice(0, 100).map((p) => (
                    <option key={p.id} value={p.id}>
                      Plant {p.id} (Row {p.row}, Pos {p.pos}) — Status: {p.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-forest-100">
                <button
                  type="button"
                  onClick={() => setAssociateModal(null)}
                  className="rounded-xl px-4 py-2 font-medium text-forest-700 hover:bg-forest-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssociation}
                  disabled={associationSaving || !selectedPlantId}
                  className="rounded-xl bg-forest-700 px-4 py-2 font-semibold text-white shadow-xs hover:bg-forest-800 transition disabled:opacity-50 cursor-pointer"
                >
                  {associationSaving ? 'Saving…' : 'Confirm Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Assistant Bubble:
 * Supports standard text messages, disease diagnosis cards, and validation rejection notices.
 */
function AssistantBubble({
  id,
  content,
  messageType,
  metadata,
  sources,
  timestamp,
  language,
  isAuthenticated,
  onAssociatePlant,
}: {
  id?: string;
  content: string;
  messageType?: string;
  metadata?: DiagnosisMetadata;
  sources?: string[];
  timestamp?: string;
  language?: ChatLanguage;
  isAuthenticated?: boolean;
  onAssociatePlant?: (msgId: string, condition: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanSpeech = content
      .replace(/[*#_`>•]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const isDiagnosis = messageType === 'diagnosis' && metadata?.top_class;
  const isRejected = messageType === 'diagnosis_rejected';

  return (
    <div className="flex items-start gap-3 w-full animate-fade-in">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-700 text-white shadow-xs mt-1">
        <Bot className="h-5 w-5" />
      </span>

      <div className="flex-1 min-w-0 rounded-2xl border border-forest-100 bg-white p-5 sm:p-6 shadow-sm">
        {/* Case 1: Structured Disease Diagnosis Card */}
        {isDiagnosis && metadata && (
          <div className="mb-4 rounded-xl border border-emerald-200/90 bg-emerald-50/50 p-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-700 text-white">
                  <Activity className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Pineapple Leaf Diagnosis
                  </p>
                  <p className="text-base font-bold text-forest-950">
                    {metadata.display_name || metadata.top_class}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white shadow-2xs">
                  {metadata.percentage ?? Math.round((metadata.score ?? 0) * 100)}% Match
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    metadata.classification === 'healthy'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  {metadata.classification === 'healthy' ? 'Healthy Foliage' : 'Disease Detected'}
                </span>
              </div>
            </div>

            {/* Probability Breakdown */}
            {metadata.ranked_classes && metadata.ranked_classes.length > 0 && (
              <div className="mt-3 pt-1">
                <p className="text-[11px] font-semibold text-emerald-900 mb-2">Confidence Distribution across Classes:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {metadata.ranked_classes.map((rc) => (
                    <div
                      key={rc.className}
                      className={`rounded-lg p-2 text-xs border ${
                        rc.className === metadata.top_class
                          ? 'border-emerald-400 bg-white font-bold text-emerald-950 shadow-2xs'
                          : 'border-emerald-200/60 bg-emerald-100/40 text-emerald-800'
                      }`}
                    >
                      <p className="truncate text-[11px]">{rc.displayName}</p>
                      <p className="text-xs">{rc.percentage}%</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Farm Planner link action */}
            {isAuthenticated && id && onAssociatePlant && (
              <div className="mt-3 pt-2.5 border-t border-emerald-200/60 flex items-center justify-between">
                <span className="text-[11px] text-emerald-800">
                  Track this plant in your precision farm grid:
                </span>
                <button
                  type="button"
                  onClick={() => onAssociatePlant(id, metadata.display_name || metadata.top_class || 'Diagnosis')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer shadow-2xs"
                >
                  <LinkIcon className="h-3 w-3" /> Link to Plant
                </button>
              </div>
            )}
          </div>
        )}

        {/* Case 2: Validation Rejection Card */}
        {isRejected && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50/80 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Image Validation Notice
                </p>
                <p className="mt-1 text-xs sm:text-sm text-amber-950 leading-relaxed font-medium">
                  {metadata?.validation?.message || content}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Core Markdown Message Body */}
        <MarkdownView content={content} />

        {/* Sources & Citations Section */}
        {sources && sources.length > 0 && (
          <div className="mt-5 pt-4 border-t border-forest-100/90 flex flex-col md:flex-row md:items-start gap-2.5 md:gap-4">
            <div className="flex items-center gap-1.5 shrink-0 text-emerald-800 font-semibold text-xs sm:text-sm">
              <BookOpen className="h-4 w-4 text-emerald-700" />
              <span>Sources &amp; Citations:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
              {sources.map((src, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-emerald-300/80 bg-emerald-50/70 px-3 py-1.5 text-xs font-medium text-emerald-950 transition hover:bg-emerald-100/70"
                >
                  {src}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Footer: Timestamp & Audio / Copy Actions */}
        <div className="mt-4 pt-1 flex items-center justify-between text-xs text-gray-400">
          <span className="font-normal">{formatMessageTime(timestamp)}</span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSpeak}
              title={isSpeaking ? 'Stop reading' : 'Read aloud'}
              className="p-1.5 rounded-lg text-gray-400 hover:text-forest-800 hover:bg-forest-50 transition cursor-pointer"
              aria-label={isSpeaking ? 'Stop reading' : 'Read aloud'}
            >
              {isSpeaking ? (
                <VolumeX className="h-4 w-4 text-forest-700 animate-pulse" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              title={copied ? 'Copied to clipboard!' : 'Copy response'}
              className="p-1.5 rounded-lg text-gray-400 hover:text-forest-800 hover:bg-forest-50 transition cursor-pointer"
              aria-label="Copy response"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * User message bubble with support for image thumbnail preview
 */
function UserBubble({
  content,
  metadata,
  timestamp,
}: {
  content: string;
  metadata?: DiagnosisMetadata;
  timestamp?: string;
}) {
  return (
    <div className="flex items-end justify-end gap-2.5 w-full animate-fade-in">
      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-sm bg-forest-700 text-white p-3.5 sm:px-4 sm:py-3 text-sm leading-relaxed shadow-xs">
        {/* Render leaf thumbnail if uploaded with message */}
        {(metadata?.thumbnail || metadata?.image_url) && (
          <div className="mb-2 overflow-hidden rounded-xl border border-white/20 bg-forest-800/60 max-w-[200px]">
            <img
              src={metadata.thumbnail || metadata.image_url}
              alt={metadata.filename || 'Uploaded leaf'}
              className="h-28 w-full object-cover"
            />
            {metadata.filename && (
              <p className="px-2 py-1 text-[10px] text-forest-200 truncate">
                {metadata.filename}
              </p>
            )}
          </div>
        )}

        <p className="whitespace-pre-wrap">{content}</p>
        <div className="mt-1 text-right text-[10px] text-forest-200">
          {formatMessageTime(timestamp)}
        </div>
      </div>
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-100 text-forest-800 shadow-xs mb-1">
        <UserIcon className="h-4 w-4" />
      </span>
    </div>
  );
}
