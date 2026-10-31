import React from 'react';
import { Plus, MessageSquare, Trash2, X, Sprout, ShieldCheck } from 'lucide-react';
import { Conversation } from '../services/types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConvId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  loading: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  conversations,
  activeConvId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  loading,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 sm:w-80 bg-[#fdfdfc] border-r border-emerald-100/90 flex flex-col transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand / Title Header */}
        <div className="p-4 sm:p-5 border-b border-emerald-100/80 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-800 text-white flex items-center justify-center shadow-xs">
              <Sprout className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-emerald-950 leading-tight">Loumi</h2>
              <p className="text-[11px] text-emerald-700 font-semibold tracking-wide">
                Your Farming Assistant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-emerald-50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3.5">
          <button
            onClick={() => {
              onNewConversation();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100/90 text-emerald-900 border border-emerald-200/90 rounded-2xl text-xs sm:text-sm font-bold shadow-2xs transition"
          >
            <Plus className="w-4 h-4 text-emerald-700" />
            New Farming Chat
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1.5">
          <div className="px-2.5 py-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Saved Conversations ({conversations.length})
          </div>

          {loading && conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400 animate-pulse">
              Loading your farming discussions...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-400">
              No conversations yet. Tap below or ask your first question!
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === activeConvId;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelectConversation(c.id);
                    onClose();
                  }}
                  className={`group relative flex items-center justify-between p-3 rounded-2xl cursor-pointer text-xs sm:text-sm transition ${
                    isActive
                      ? 'bg-emerald-100/70 text-emerald-950 border border-emerald-300/80 font-semibold shadow-2xs'
                      : 'hover:bg-emerald-50/60 text-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-6">
                    <MessageSquare
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? 'text-emerald-700' : 'text-gray-400'
                      }`}
                    />
                    <div className="truncate">
                      <p className="truncate leading-snug">{c.title || 'Farming Session'}</p>
                      {c.last_message_preview && (
                        <p className="text-[11px] text-gray-600 truncate font-normal mt-0.5">
                          {c.last_message_preview}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this conversation?')) {
                        onDeleteConversation(c.id);
                      }
                    }}
                    title="Delete conversation"
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Knowledge & Privacy Footer */}
        <div className="p-3.5 border-t border-emerald-100 bg-[#f7f7f4]">
          <div className="flex items-center gap-2 text-[11px] text-gray-600 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span>Private & Stored on Device • Verified Ag Science</span>
          </div>
        </div>
      </aside>
    </>
  );
};
