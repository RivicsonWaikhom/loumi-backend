import React from 'react';
import { UserCheck, ChevronDown, MapPin } from 'lucide-react';
import { User } from '../services/types';

interface UserSelectorProps {
  users: User[];
  currentUser: User | null;
  onSelectUser: (userId: string) => void;
  disabled: boolean;
}

export const UserSelector: React.FC<UserSelectorProps> = ({
  users,
  currentUser,
  onSelectUser,
  disabled,
}) => {
  return (
    <div className="flex items-center gap-2">
      <div className="relative inline-block text-left">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50/90 border border-emerald-200 hover:border-emerald-400 rounded-2xl text-xs sm:text-sm shadow-2xs transition cursor-pointer">
          <div className="w-6 h-6 rounded-full bg-emerald-800 text-emerald-100 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {currentUser ? currentUser.name[0] : 'F'}
          </div>
          <div className="text-left flex items-center gap-1.5">
            <span className="font-bold text-emerald-950 truncate max-w-[120px] sm:max-w-[160px]">
              {currentUser ? currentUser.name : 'Select Farmer'}
            </span>
            {currentUser?.district && (
              <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-emerald-800 bg-emerald-200/60 px-1.5 py-0.5 rounded-md font-semibold">
                <MapPin className="w-2.5 h-2.5" />
                {currentUser.district}
              </span>
            )}
          </div>
          <select
            value={currentUser?.id || ''}
            onChange={(e) => onSelectUser(e.target.value)}
            disabled={disabled}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            title="Switch farmer profile"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.district || 'Manipur'}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-emerald-700 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};
