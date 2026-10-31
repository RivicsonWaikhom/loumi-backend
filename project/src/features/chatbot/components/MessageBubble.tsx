import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  BookOpen,
  Sprout,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Message, SourceCitation } from '../services/types';
import { speakText, stopSpeaking } from '../services/speech';
import { MarkdownView } from './MarkdownView';

interface MessageBubbleProps {
  message: Message;
  activeSpeechId: string | null;
  onStartSpeech: (id: string) => void;
  onStopSpeech: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  activeSpeechId,
  onStartSpeech,
  onStopSpeech,
}) => {
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === 'user';
  const isSpeaking = activeSpeechId === message.id;

  const handleToggleSpeech = () => {
    if (isSpeaking) {
      stopSpeaking();
      onStopSpeech();
    } else {
      onStartSpeech(message.id);
      // Auto-detect Hindi characters for voice selection
      const isHindi = /[\u0900-\u097F]/.test(message.content);
      speakText(message.content, {
        preferredLocale: isHindi ? 'hi-IN' : 'en-IN',
        rate: isHindi ? 0.95 : 0.98,
        onStart: () => onStartSpeech(message.id),
        onEnd: () => onStopSpeech(),
        onError: () => onStopSpeech(),
      });
    }
  };

  // Parse metadata if present
  let meta: any = null;
  if (message.metadata_json) {
    try {
      meta = JSON.parse(message.metadata_json);
    } catch {
      meta = null;
    }
  }

  const sources: SourceCitation[] = message.sources || meta?.sources || [];
  const thumbnail = meta?.thumbnail_url || meta?.image_url;

  return (
    <div className={`flex gap-2.5 sm:gap-3.5 my-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Bot Avatar */}
      {!isUser && (
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 flex-shrink-0 mt-1 shadow-2xs">
          <Sprout className="w-5 h-5 text-emerald-700" />
        </div>
      )}

      {/* Bubble Container */}
      <div
        className={`max-w-[92%] sm:max-w-xl md:max-w-2xl rounded-3xl p-4 sm:p-5 shadow-xs ${
          isUser
            ? 'bg-emerald-800 text-white rounded-tr-xs'
            : 'bg-white text-gray-900 border border-emerald-100/90 rounded-tl-xs'
        }`}
      >
        {/* Attached image preview */}
        {thumbnail && (
          <div className="mb-3.5 rounded-2xl overflow-hidden border border-emerald-200 bg-black/5 max-w-[280px]">
            <img
              src={thumbnail}
              alt="Uploaded plant leaf"
              className="w-full h-auto object-cover max-h-56"
            />
          </div>
        )}

        {/* Message Text */}
        {isUser ? (
          <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium">
            {message.content}
          </div>
        ) : (
          <MarkdownView content={message.content} />
        )}

        {/* Assistant Footer: Read Aloud + Citations Toggle */}
        {!isUser && (
          <div className="mt-4 pt-3 border-t border-emerald-50 flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Read Aloud Button */}
            <button
              type="button"
              onClick={handleToggleSpeech}
              title={isSpeaking ? 'Stop voice playback' : 'Read answer aloud in clear natural voice'}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition text-xs shadow-2xs ${
                isSpeaking
                  ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80'
              }`}
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="w-4 h-4 text-red-600" />
                  <span>Stop Reading</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-700" />
                  <span>Read Aloud</span>
                </>
              )}
            </button>

            {/* Citations Accordion */}
            {sources.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSources(!showSources)}
                className="px-2.5 py-1.5 rounded-xl text-gray-600 hover:text-emerald-800 hover:bg-emerald-50/60 font-medium flex items-center gap-1 transition"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                <span>{sources.length} Scientific Source{sources.length > 1 ? 's' : ''}</span>
                {showSources ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        )}

        {/* Expanded Sources Details */}
        {!isUser && showSources && sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-emerald-100/70 space-y-2 text-xs text-gray-700 bg-emerald-50/40 p-3 rounded-2xl animate-fade-in">
            <div className="font-bold text-emerald-950 flex items-center gap-1.5 mb-1.5">
              <BookOpen className="w-4 h-4 text-emerald-700" />
              <span>Verified Agricultural Research References:</span>
            </div>
            {sources.map((s, idx) => (
              <div key={idx} className="bg-white p-2.5 rounded-xl border border-emerald-100/80 shadow-2xs">
                <div className="font-semibold text-emerald-900">{s.heading}</div>
                <div className="text-gray-500 text-[11px] mt-0.5 flex items-center gap-2">
                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{s.document}</span>
                  <span>Page {s.page}</span>
                  <span className="text-emerald-700 font-medium">Relevance: {s.score.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
