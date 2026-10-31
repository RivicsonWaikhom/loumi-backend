import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Sprout,
  AlertCircle,
  ArrowUp,
  Loader2,
  Camera,
  Mic,
  Volume2,
  HelpCircle,
  Sparkles,
  ChevronRight,
  Plus,
  Languages,
} from 'lucide-react';
import {
  User,
  Conversation,
  Message,
  DiseaseDiagnosisResult,
  ChatLanguage,
} from './services/types';
import {
  fetchUsers,
  loginUser,
  getStoredUser,
  getStoredToken,
  fetchConversations,
  createConversation,
  deleteConversation,
  fetchMessages,
  postMessage,
  uploadAndValidateImage,
  saveDiagnosisToConversation,
} from './services/chatbotApi';
import { Sidebar } from './components/Sidebar';
import { MessageBubble } from './components/MessageBubble';
import { ChatInput } from './components/ChatInput';
import { UserSelector } from './components/UserSelector';
import { CheckMyPlantModal } from './components/CheckMyPlantModal';
import { speakText, stopSpeaking } from './services/speech';

export interface ChatbotViewProps {
  initialLanguage?: ChatLanguage;
  authToken?: string;
  user?: User;
  onLanguageChange?: (lang: ChatLanguage) => void;
  className?: string;
}

const UI_STRINGS = {
  en: {
    appTitle: 'Your Farming Assistant',
    badge: 'Loumi Agricultural AI',
    welcomePrefix: 'Welcome,',
    welcomeFallback: 'Farmer',
    welcomeSub: 'Ask any question about pineapple and rice cultivation, inspect your crop leaves for diseases, or speak using your voice. All advice is grounded in agricultural science.',
    checkPlantBtn: 'Check My Plant',
    newChatBtn: 'New Chat',
    card1Title: '🌱 Ask a Farming Question',
    card1Sub: 'Get advice on soil, plant spacing, fertilizer schedules, and general crop care.',
    card2Title: '📷 Detect Crop Disease',
    card2Sub: 'Take or upload a leaf photo to screen for blight, fusarium, or mealybug wilt.',
    card3Title: '🎤 Ask Using Voice',
    card3Sub: 'Speak clearly instead of typing. Loumi will transcribe your question accurately.',
    card4Title: '🔊 Listen to Answers',
    card4Sub: 'Loumi speaks answers aloud so you can listen hands-free while working in your field.',
    suggestedHeading: 'Tap a question to get instant answers:',
    placeholder: 'Ask about pineapple diseases, soil, fertilizers, or rice...',
    analyzingNotice: 'Searching agricultural documents and preparing guidance...',
    questions: [
      'What diseases affect pineapple plants?',
      'How do I prevent pineapple leaf blight?',
      'When should I apply fertilizer to rice?',
      'How can I identify a healthy pineapple plant?',
      'What are the symptoms of mealybug wilt?',
      'How do I treat Phytophthora heart rot?',
    ],
  },
  hi: {
    appTitle: 'आपका कृषि सहायक (Your Farming Assistant)',
    badge: 'लौमी कृषि एआई (Loumi AI)',
    welcomePrefix: 'स्वागत है,',
    welcomeFallback: 'किसान मित्र',
    welcomeSub: 'अनानास और धान की खेती से संबंधित कोई भी प्रश्न पूछें, फसल के पत्तों में बीमारी की जाँच करें, या बोलकर पूछें। सभी सलाह वैज्ञानिक कृषि शोध पर आधारित हैं।',
    checkPlantBtn: 'फसल रोग जाँचें',
    newChatBtn: 'नया प्रश्न',
    card1Title: '🌱 खेती का प्रश्न पूछें',
    card1Sub: 'मिट्टी, रोपाई की दूरी, खाद की खुराक और फसल की देखभाल पर सलाह लें।',
    card2Title: '📷 फसल रोग की जाँच करें',
    card2Sub: 'झुलसा (ब्लाइट), फ्यूजेरियम या मिलीबग विल्ट की पहचान के लिए पत्ते का फोटो अपलोड करें।',
    card3Title: '🎤 बोलकर प्रश्न पूछें',
    card3Sub: 'टाइप करने के बजाय बोलें। लौमी आपकी आवाज पहचानकर तुरंत मार्गदर्शन करेगा।',
    card4Title: '🔊 उत्तर बोलकर सुनें',
    card4Sub: 'खेत में काम करते समय बिना हाथ लगाए उत्तर को स्पष्ट आवाज में सुनें।',
    suggestedHeading: 'त्वरित उत्तर के लिए नीचे किसी प्रश्न पर टैप करें:',
    placeholder: 'अनानास के रोग, मिट्टी, खाद या धान के बारे में पूछें...',
    analyzingNotice: 'कृषि संदर्भ दस्तावेज़ों की खोज एवं वैज्ञानिक उत्तर तैयार किया जा रहा है...',
    questions: [
      'अनानास में कौन-कौन से मुख्य रोग होते हैं?',
      'अनानास के पत्ती झुलसा (लीफ ब्लाइट) की रोकथाम कैसे करें?',
      'मणिपुर में धान में खाद कब और कैसे डालें?',
      'स्वस्थ अनानास के पौधे की पहचान कैसे करें?',
      'मिलीबग विल्ट रोग के लक्षण क्या हैं?',
      'फाइटोफ्थोरा सड़न (हार्ट रॉट) का प्रबंधन कैसे करें?',
    ],
  },
};

export const ChatbotView: React.FC<ChatbotViewProps> = ({
  initialLanguage = 'en',
  authToken,
  user,
  onLanguageChange,
  className = '',
}) => {
  const [language, setLanguage] = useState<ChatLanguage>(initialLanguage);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(user || null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCheckPlantOpen, setIsCheckPlantOpen] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialLoadRef = useRef(false);

  const t = UI_STRINGS[language];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLanguageToggle = (newLang: ChatLanguage) => {
    setLanguage(newLang);
    onLanguageChange?.(newLang);
  };

  // 1. Fast Initial Load: checks localStorage first to skip redundant login roundtrips
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    async function initialize() {
      try {
        const storedUser = user || getStoredUser();
        const storedToken = authToken || getStoredToken();

        // Fetch dev users in background for the switch dropdown
        fetchUsers()
          .then((devUsers) => setUsers(devUsers))
          .catch(() => {});

        if (storedToken && storedUser && (!user || storedUser.id === user.id)) {
          // Fast path: reuse existing auth immediately
          setCurrentUser(storedUser);
          await loadUserConversations(storedUser.id);
        } else if (user) {
          // Authenticate through the verified ChatBot backend for this user
          const authData = await loginUser(user.id);
          setCurrentUser(authData.user);
          await loadUserConversations(authData.user.id);
        } else {
          // Initial fallback login
          const devUsers = await fetchUsers();
          setUsers(devUsers);
          if (devUsers.length > 0) {
            const authData = await loginUser(devUsers[0].id);
            setCurrentUser(authData.user);
            await loadUserConversations(authData.user.id);
          }
        }
      } catch (err: any) {
        setErrorBanner(`Application setup note: ${err.message}`);
      }
    }

    initialize();

    return () => {
      stopSpeaking();
    };
  }, []);

  // 2. Load conversations for active user
  const loadUserConversations = async (userId: string) => {
    setLoadingConv(true);
    try {
      const convList = await fetchConversations();
      setConversations(convList);
      if (convList.length > 0) {
        await selectConversation(convList[0].id);
      } else {
        const title = language === 'hi' ? 'लौमी में आपका स्वागत है' : 'Welcome to Loumi';
        const newConv = await createConversation(title);
        setConversations([newConv]);
        await selectConversation(newConv.id);
      }
    } catch (err: any) {
      setErrorBanner(`Error loading conversations: ${err.message}`);
    } finally {
      setLoadingConv(false);
    }
  };

  useEffect(() => {
    if (user && user.id !== currentUser?.id) {
      loginUser(user.id)
        .then((authData) => {
          setCurrentUser(authData.user);
          loadUserConversations(authData.user.id);
        })
        .catch((e) => console.warn('Could not switch chatbot user:', e));
    }
  }, [user?.id]);

  // 3. Switch user account without page reload
  const handleSelectUser = async (userId: string) => {
    stopSpeaking();
    setActiveSpeechId(null);
    setLoadingConv(true);
    try {
      const authData = await loginUser(userId);
      setCurrentUser(authData.user);
      setMessages([]);
      setActiveConvId(null);
      await loadUserConversations(authData.user.id);
    } catch (err: any) {
      setErrorBanner(`Error switching accounts: ${err.message}`);
    } finally {
      setLoadingConv(false);
    }
  };

  // 4. Select and restore conversation
  const selectConversation = async (convId: string) => {
    stopSpeaking();
    setActiveSpeechId(null);
    setActiveConvId(convId);
    setLoadingMessages(true);
    try {
      const data = await fetchMessages(convId, 50);
      setMessages(data.messages);
      setHasMoreMessages(data.has_more);
      setNextCursor(data.next_cursor || null);
      setTimeout(scrollToBottom, 50);
    } catch (err: any) {
      setErrorBanner(`Error restoring conversation: ${err.message}`);
    } finally {
      setLoadingMessages(false);
    }
  };

  // 5. Load earlier messages with cursor pagination
  const handleLoadEarlier = async () => {
    if (!activeConvId || !nextCursor || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const data = await fetchMessages(activeConvId, 50, nextCursor);
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMoreMessages(data.has_more);
      setNextCursor(data.next_cursor || null);
    } catch (err: any) {
      setErrorBanner(`Failed to load earlier messages: ${err.message}`);
    } finally {
      setLoadingEarlier(false);
    }
  };

  // 6. Create new conversation
  const handleNewConversation = async () => {
    stopSpeaking();
    setActiveSpeechId(null);
    try {
      const title = language === 'hi' ? 'नया कृषि प्रश्न' : 'New Farming Question';
      const newConv = await createConversation(title);
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(newConv.id);
      setMessages([]);
      setHasMoreMessages(false);
      setNextCursor(null);
    } catch (err: any) {
      setErrorBanner(`Failed to create new conversation: ${err.message}`);
    }
  };

  // 7. Delete conversation
  const handleDeleteConversation = async (convId: string) => {
    try {
      await deleteConversation(convId);
      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);
      if (activeConvId === convId) {
        if (remaining.length > 0) {
          selectConversation(remaining[0].id);
        } else {
          handleNewConversation();
        }
      }
    } catch (err: any) {
      setErrorBanner(`Failed to delete conversation: ${err.message}`);
    }
  };

  // 8. Send user message with immediate optimistic display
  const handleSendMessage = async (text: string, imageFile: File | null) => {
    stopSpeaking();
    setActiveSpeechId(null);

    let convId = activeConvId;
    if (!convId) {
      const newConv = await createConversation(text.slice(0, 32));
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(newConv.id);
      convId = newConv.id;
    }

    setIsSending(true);

    try {
      let metadataJson: string | undefined = undefined;

      // Validate image if attached
      if (imageFile) {
        const imgResult = await uploadAndValidateImage(imageFile);
        metadataJson = JSON.stringify({
          thumbnail_url: imgResult.thumbnail_url,
          image_filename: imgResult.filename,
          width: imgResult.width,
          height: imgResult.height,
        });
      }

      // Optimistically display user message immediately
      const tempUserMsg: Message = {
        id: `temp_${Date.now()}`,
        conversation_id: convId,
        role: 'user',
        content: text,
        message_type: imageFile ? 'image' : 'text',
        metadata_json: metadataJson,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);
      setTimeout(scrollToBottom, 30);

      // Post to backend with language parameter
      const asstMsg = await postMessage(
        convId,
        text,
        imageFile ? 'image' : 'text',
        metadataJson,
        language
      );

      // Append assistant message immediately
      setMessages((prev) => [...prev, asstMsg]);
      setTimeout(scrollToBottom, 30);

      // Update sidebar title and timestamp
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                updated_at: new Date().toISOString(),
                last_message_preview: text.slice(0, 60),
                title:
                  c.title === 'New Farming Chat' ||
                  c.title === 'New Farming Question' ||
                  c.title === 'नया कृषि प्रश्न' ||
                  c.title === 'Welcome to Loumi' ||
                  c.title === 'लौमी में आपका स्वागत है'
                    ? text.slice(0, 32)
                    : c.title,
              }
            : c
        )
      );
    } catch (err: any) {
      setErrorBanner(`Failed to receive answer: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // 9. Save Disease Diagnosis result directly into conversation
  const handleSaveDiagnosisToChat = async (diagnosis: DiseaseDiagnosisResult) => {
    let convId = activeConvId;
    if (!convId) {
      const newConv = await createConversation(`Diagnosis: ${diagnosis.disease_name}`);
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(newConv.id);
      convId = newConv.id;
    }

    setIsSending(true);
    try {
      const userContent =
        language === 'hi'
          ? `मैंने अपने पौधे के पत्ते की जाँच की। परिणाम: ${diagnosis.disease_name} (${diagnosis.confidence_percent} समानता)।`
          : `I screened my plant leaf for disease. Result was: ${diagnosis.disease_name} (${diagnosis.confidence_percent} match).`;

      // Save directly to backend database as an authentic user inquiry + assistant report pair
      const savedMessages = await saveDiagnosisToConversation(
        convId,
        userContent,
        diagnosis.summary_markdown,
        diagnosis.thumbnail_url,
        diagnosis,
        language
      );

      // Append both messages directly without re-triggering knowledge synthesis or duplicate scope banners
      setMessages((prev) => [...prev, ...savedMessages]);
      setTimeout(scrollToBottom, 40);

      // Update conversation title
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                title: `${diagnosis.disease_name}`,
                last_message_preview: `Diagnosed: ${diagnosis.disease_name}`,
                updated_at: new Date().toISOString(),
              }
            : c
        )
      );
    } catch (err: any) {
      setErrorBanner(`Could not save diagnosis to chat: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Play audio greeting for "Listen to the Answer"
  const handlePlayVoiceDemo = () => {
    stopSpeaking();
    if (language === 'hi') {
      speakText(
        'नमस्ते! मैं लौमी का कृषि सहायक हूँ। आप अनानास या धान की खेती के बारे में कोई भी प्रश्न पूछ सकते हैं, और मैं आपको खेत में बोलकर उत्तर सुनाऊँगा।',
        {
          preferredLocale: 'hi-IN',
          rate: 0.95,
        }
      );
    } else {
      speakText(
        'Welcome to Loumi, your farming assistant. You can ask any question about pineapple or rice cultivation, and I will read clear answers out loud for you in the field.',
        {
          preferredLocale: 'en-IN',
          rate: 0.98,
        }
      );
    }
  };

  return (
    <div className={`flex bg-[#fcfbf7] overflow-hidden font-sans ${className || 'h-screen'}`}>
      {/* Mobile/Desktop Conversation History Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConversation={selectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        loading={loadingConv}
      />

      {/* Main Chat Assistant Viewport */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#fcfbf7] h-full">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-emerald-100/90 px-3 sm:px-6 flex items-center justify-between shadow-2xs z-10 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-1 text-emerald-900 hover:bg-emerald-50 rounded-2xl md:hidden transition"
              title="Open Chat History"
            >
              <Menu className="w-5 h-5 text-emerald-800" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-800 text-white flex items-center justify-center shadow-xs">
                <Sprout className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-extrabold text-emerald-950 leading-tight">
                  {t.appTitle}
                </h1>
                <p className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold tracking-wide flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  {t.badge}
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Language Switcher */}
            <div className="inline-flex items-center bg-emerald-50 p-1 rounded-2xl border border-emerald-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => handleLanguageToggle('en')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                  language === 'en'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-emerald-800 hover:text-emerald-950'
                }`}
                title="Switch to English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => handleLanguageToggle('hi')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                  language === 'hi'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-emerald-800 hover:text-emerald-950'
                }`}
                title="हिन्दी में बदलें"
              >
                हिन्दी
              </button>
            </div>

            {/* Check Plant Action Button */}
            <button
              type="button"
              onClick={() => setIsCheckPlantOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl text-xs font-bold shadow-xs transition"
            >
              <Camera className="w-4 h-4 text-emerald-300" />
              <span>{t.checkPlantBtn}</span>
            </button>

            {/* Farmer Account Switcher */}
            {users.length > 0 && (
              <UserSelector
                users={users}
                currentUser={currentUser}
                onSelectUser={handleSelectUser}
                disabled={isSending || loadingConv}
              />
            )}

            {/* New Chat Button */}
            <button
              type="button"
              onClick={handleNewConversation}
              className="p-2 sm:px-3 sm:py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-2xl text-xs font-bold transition flex items-center gap-1 shadow-2xs"
              title="Start New Question"
            >
              <Plus className="w-4 h-4 text-emerald-700" />
              <span className="hidden lg:inline">{t.newChatBtn}</span>
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {errorBanner && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-950 text-xs sm:text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-amber-800 hover:text-amber-950 font-bold px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Message Stream Viewport */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3">
          {/* Load Earlier Messages Button */}
          {hasMoreMessages && (
            <div className="flex justify-center mb-3">
              <button
                onClick={handleLoadEarlier}
                disabled={loadingEarlier}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-semibold shadow-2xs transition"
              >
                {loadingEarlier ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading history...</span>
                  </>
                ) : (
                  <>
                    <ArrowUp className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Load earlier messages</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Loading Initial Messages */}
          {loadingMessages ? (
            <div className="flex flex-col items-center justify-center h-56 text-gray-500 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
              <p className="text-xs sm:text-sm font-medium">Opening session...</p>
            </div>
          ) : messages.length === 0 ? (
            /* FARMER-FRIENDLY HOMEPAGE */
            <div className="max-w-3xl mx-auto py-4 sm:py-6 px-2 space-y-6 animate-fade-in">
              {/* Hero Greeting Box */}
              <div className="text-center space-y-2 py-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100/80 text-emerald-800 rounded-full text-xs font-bold mb-1">
                  <Sprout className="w-4 h-4 text-emerald-700" />
                  <span>
                    {t.welcomePrefix} {currentUser ? currentUser.name : t.welcomeFallback}!
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-950 tracking-tight">
                  {t.appTitle}
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 max-w-xl mx-auto leading-relaxed">
                  {t.welcomeSub}
                </p>
              </div>

              {/* 4 Large Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* 1. Ask a Farming Question */}
                <div
                  onClick={() => {
                    const textarea = document.querySelector('textarea');
                    textarea?.focus();
                  }}
                  className="p-5 bg-white hover:bg-emerald-50/60 border-2 border-emerald-100 hover:border-emerald-300 rounded-3xl cursor-pointer shadow-xs transition group"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Sprout className="w-6 h-6 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 group-hover:text-emerald-900">
                        {t.card1Title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t.card1Sub}</p>
                    </div>
                  </div>
                </div>

                {/* 2. Detect Crop Disease */}
                <div
                  onClick={() => setIsCheckPlantOpen(true)}
                  className="p-5 bg-white hover:bg-emerald-50/60 border-2 border-emerald-100 hover:border-emerald-300 rounded-3xl cursor-pointer shadow-xs transition group"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Camera className="w-6 h-6 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 group-hover:text-emerald-900">
                        {t.card2Title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t.card2Sub}</p>
                    </div>
                  </div>
                </div>

                {/* 3. Ask Using Voice */}
                <div
                  onClick={() => {
                    const micBtn = document.querySelector('button[title*="voice"]') as HTMLButtonElement;
                    micBtn?.click();
                  }}
                  className="p-5 bg-white hover:bg-emerald-50/60 border-2 border-emerald-100 hover:border-emerald-300 rounded-3xl cursor-pointer shadow-xs transition group"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Mic className="w-6 h-6 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 group-hover:text-emerald-900">
                        {t.card3Title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t.card3Sub}</p>
                    </div>
                  </div>
                </div>

                {/* 4. Listen to Answers */}
                <div
                  onClick={handlePlayVoiceDemo}
                  className="p-5 bg-white hover:bg-emerald-50/60 border-2 border-emerald-100 hover:border-emerald-300 rounded-3xl cursor-pointer shadow-xs transition group"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Volume2 className="w-6 h-6 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 group-hover:text-emerald-900">
                        {t.card4Title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t.card4Sub}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Suggested Questions Section */}
              <div className="pt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-xs sm:text-sm font-bold text-emerald-950 uppercase tracking-wider">
                    {t.suggestedHeading}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {t.questions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(q, null)}
                      className="p-3.5 bg-white hover:bg-emerald-50/80 border border-emerald-200/90 rounded-2xl text-left text-xs sm:text-sm font-semibold text-gray-800 hover:text-emerald-900 transition flex items-center justify-between shadow-2xs group"
                    >
                      <span>"{q}"</span>
                      <ChevronRight className="w-4 h-4 text-emerald-500 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                activeSpeechId={activeSpeechId}
                onStartSpeech={(id) => setActiveSpeechId(id)}
                onStopSpeech={() => setActiveSpeechId(null)}
              />
            ))
          )}

          {/* Instant Assistant Typing Indicator */}
          {isSending && (
            <div className="flex items-center gap-3 my-3 text-emerald-900 text-xs sm:text-sm animate-pulse">
              <div className="w-9 h-9 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
              </div>
              <div className="bg-white border border-emerald-200/80 px-4 py-3 rounded-2xl shadow-2xs font-medium text-emerald-900">
                <span>{t.analyzingNotice}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Chat Input Bar */}
        <ChatInput
          onSendMessage={handleSendMessage}
          onOpenCheckPlant={() => setIsCheckPlantOpen(true)}
          disabled={isSending || loadingMessages}
        />
      </div>

      {/* Dedicated Check My Plant Modal */}
      <CheckMyPlantModal
        isOpen={isCheckPlantOpen}
        onClose={() => setIsCheckPlantOpen(false)}
        onSendToChat={handleSaveDiagnosisToChat}
      />
    </div>
  );
};

export default ChatbotView;
