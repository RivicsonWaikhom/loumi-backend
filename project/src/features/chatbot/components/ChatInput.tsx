import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Paperclip, Camera, X, Loader2, Volume2, Sparkles } from 'lucide-react';
import { SpeechRecognizer, isSpeechRecognitionSupported } from '../services/speech';
import { CameraModal } from './CameraModal';

interface ChatInputProps {
  onSendMessage: (text: string, imageFile: File | null) => Promise<void>;
  onOpenCheckPlant?: () => void;
  disabled: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, onOpenCheckPlant, disabled }) => {
  const [text, setText] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [micNotice, setMicNotice] = useState<{ message: string; type: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en-IN');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognizerRef = useRef<SpeechRecognizer | null>(null);

  useEffect(() => {
    if (isSpeechRecognitionSupported()) {
      recognizerRef.current = new SpeechRecognizer();
    }
  }, []);

  // Auto-resize textarea based on text content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleToggleMic = () => {
    setMicNotice(null);

    if (!isSpeechRecognitionSupported() || !recognizerRef.current) {
      setMicNotice({
        message: 'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari, or type your question below.',
        type: 'unsupported',
      });
      return;
    }

    if (isListening) {
      recognizerRef.current.stop();
      setIsListening(false);
      setInterimTranscript('');
    } else {
      recognizerRef.current.start(
        {
          onStart: () => {
            setIsListening(true);
            setMicNotice(null);
            setInterimTranscript('');
          },
          onInterim: (interim) => {
            // Live preview only — NEVER append to text state directly
            setInterimTranscript(interim);
          },
          onFinal: (finalChunk) => {
            // Append final result exactly once to text
            const chunk = finalChunk.trim();
            if (chunk) {
              setText((prev) => {
                const trimmed = prev.trim();
                return trimmed ? `${trimmed} ${chunk}` : chunk;
              });
            }
            setInterimTranscript('');
          },
          onError: (errorMessage, errorType) => {
            setIsListening(false);
            setInterimTranscript('');
            if (errorType !== 'aborted') {
              setMicNotice({ message: errorMessage, type: errorType });
            }
          },
          onEnd: () => {
            setIsListening(false);
            setInterimTranscript('');
          },
        },
        selectedLang
      );
    }
  };

  const handleStopMic = () => {
    if (recognizerRef.current) {
      recognizerRef.current.stop();
    }
    setIsListening(false);
    setInterimTranscript('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Please select a JPG, PNG, or WebP image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image file exceeds the 10MB size limit.');
      return;
    }

    setAttachedImage(file);
    const preview = URL.createObjectURL(file);
    setImagePreviewUrl(preview);
  };

  const handleCameraCapture = (file: File) => {
    setAttachedImage(file);
    const preview = URL.createObjectURL(file);
    setImagePreviewUrl(preview);
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setAttachedImage(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isListening) {
      handleStopMic();
    }

    const trimmed = text.trim();
    if ((!trimmed && !attachedImage) || disabled || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const msgText = trimmed || 'Uploaded plant photograph for examination.';
      const img = attachedImage;
      setText('');
      setInterimTranscript('');
      handleRemoveImage();
      await onSendMessage(msgText, img);
    } finally {
      setIsSubmitting(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-3 sm:p-4">
      {/* Microphone status or error notice */}
      {micNotice && (
        <div className="mb-2 p-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
            <span>{micNotice.message}</span>
          </div>
          <button
            onClick={() => setMicNotice(null)}
            className="text-amber-700 hover:text-amber-900 p-1 rounded hover:bg-amber-100 transition"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Live Interim Transcript Preview Banner */}
      {isListening && (
        <div className="mb-2.5 px-3.5 py-2 bg-loumi-50 border border-loumi-300/80 rounded-xl flex items-center justify-between text-xs shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5 overflow-hidden pr-2">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <div className="truncate">
              <span className="font-semibold text-loumi-900 mr-1.5">Listening:</span>
              <span className="italic text-gray-700">
                {interimTranscript ? `"${interimTranscript}"` : 'Speak your question clearly...'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStopMic}
            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-semibold transition flex-shrink-0 shadow-2xs"
          >
            Done
          </button>
        </div>
      )}

      {/* Attached image preview banner */}
      {imagePreviewUrl && attachedImage && (
        <div className="mb-3 p-2 bg-loumi-50 border border-loumi-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src={imagePreviewUrl}
              alt="Preview"
              className="w-12 h-12 object-cover rounded-lg border border-loumi-300"
            />
            <div className="text-xs truncate">
              <p className="font-semibold text-gray-800 truncate">{attachedImage.name}</p>
              <p className="text-gray-500">{(attachedImage.size / (1024 * 1024)).toFixed(2)} MB • Ready for analysis</p>
            </div>
          </div>
          <button
            onClick={handleRemoveImage}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-white rounded-full transition"
            title="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 sm:gap-2.5">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Attachment & Plant Check Controls */}
        <div className="flex items-center gap-1 pb-1">
          {onOpenCheckPlant ? (
            <button
              type="button"
              onClick={onOpenCheckPlant}
              title="Check plant for disease"
              disabled={disabled}
              className="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-2xl transition flex items-center gap-1.5 shadow-2xs font-semibold text-xs"
            >
              <Camera className="w-4 h-4 text-emerald-700" />
              <span className="hidden sm:inline">Check Plant</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              title="Take photo with camera"
              disabled={disabled}
              className="p-2.5 hover:text-emerald-700 hover:bg-emerald-50 rounded-2xl transition text-gray-400"
            >
              <Camera className="w-5 h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach photo from files"
            disabled={disabled}
            className="p-2.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-2xl transition"
          >
            <Paperclip className="w-5 h-5" />
          </button>
        </div>

        {/* Text Input */}
        <div className="flex-1 relative bg-white border-2 border-emerald-100 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100 rounded-2xl transition shadow-2xs">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? 'Listening to your voice...'
                : 'Ask a farming question or tap microphone...'
            }
            disabled={disabled}
            className="w-full resize-none bg-transparent px-3.5 py-3 text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:outline-none leading-relaxed"
          />
        </div>

        {/* Large Mic & Send Controls */}
        <div className="flex items-center gap-1.5 pb-1">
          <button
            type="button"
            onClick={handleToggleMic}
            title={isListening ? 'Stop listening' : 'Ask question by voice (Speak)'}
            disabled={disabled}
            className={`p-3 rounded-2xl transition flex items-center justify-center shadow-xs ${
              isListening
                ? 'bg-red-600 text-white animate-pulse shadow-md'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-700" />}
          </button>

          <button
            type="submit"
            disabled={(!text.trim() && !attachedImage) || disabled || isSubmitting}
            className="p-3 bg-emerald-800 hover:bg-emerald-900 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-2xl shadow-sm transition flex items-center justify-center"
            title="Send farming question"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>

      {/* Camera Capture Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};
