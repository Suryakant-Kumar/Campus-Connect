import React, { useState } from 'react';
import {
  Building2,
  Shield,
  User as UserIcon,
  LogOut,
  ChevronDown,
  Layers,
  ExternalLink,
  Plus,
  Radio,
} from 'lucide-react';
import { Campus, User, UserRole } from '../types';

interface NavbarProps {
  currentCampus: Campus | null;
  currentUser: User | null;
  onLogout: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  campusesList: Campus[];
  onSelectCampus: (slug: string | null) => void;
  activeView?: 'feed' | 'admin' | 'worker';
  onSelectView?: (view: 'feed' | 'admin' | 'worker') => void;
  onOpenRaiseModal?: () => void;
  userTab?: 'feed' | 'my_tickets' | 'resolved';
  onSelectUserTab?: (tab: 'feed' | 'my_tickets' | 'resolved') => void;
}

const ROLE_COLORS: Record<UserRole, { bg: string; text: string; label: string }> = {
  founder: { bg: 'bg-rose-500/20 border-rose-300/40', text: 'text-rose-100', label: 'Founder' },
  admin: { bg: 'bg-indigo-500/20 border-indigo-300/40', text: 'text-indigo-100', label: 'Admin' },
  co_admin: { bg: 'bg-cyan-500/20 border-cyan-300/40', text: 'text-cyan-100', label: 'Co-Admin' },
  worker: { bg: 'bg-amber-500/20 border-amber-300/40', text: 'text-amber-100', label: 'Staff Worker' },
  user: { bg: 'bg-white/20 border-white/40', text: 'text-white', label: 'Resident' },
};

export const Navbar: React.FC<NavbarProps> = ({
  currentCampus,
  currentUser,
  onLogout,
  onOpenAuth,
  campusesList,
  onSelectCampus,
  activeView = 'feed',
  onSelectView,
  onOpenRaiseModal,
  userTab = 'feed',
  onSelectUserTab,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isAdminOrHigher = currentUser && ['admin', 'co_admin', 'founder'].includes(currentUser.role);
  const isWorker = currentUser && currentUser.role === 'worker';

  return (
    <header className="sticky top-0 left-0 right-0 z-50 pt-3 px-3 sm:px-6 lg:px-8 pb-3">
      <div className="max-w-7xl mx-auto h-16 sm:h-14 bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-4 sm:px-6 shadow-[0_12px_32px_-4px_rgba(17,80,239,0.18)] flex items-center justify-between gap-3 text-white">
        {/* Brand Emblem & Subdomain */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectCampus(null)}
            className="flex items-center gap-2.5 text-left group transition cursor-pointer"
            title="Go to CampusConnect Main Site"
          >
            <div className="w-8 h-8 rounded-full bg-white text-[#003bbe] flex items-center justify-center shadow-md font-bold text-sm tracking-tight">
              CC
            </div>
            <div className="flex flex-col">
              <span className="font-headline font-bold text-sm sm:text-base text-white tracking-tight uppercase leading-none">
                CampusConnect
              </span>
              <span className="text-[10px] text-white/80 tracking-widest uppercase leading-none mt-1 font-mono">
                {currentCampus ? `${currentCampus.slug}.campusconnect.com` : 'Multi-Tenant Network'}
              </span>
            </div>
          </button>
        </div>

        {/* Center Nav Links (Desktop) */}
        {currentCampus && (
          <nav className="hidden md:flex items-center gap-1 bg-white/10 p-1 rounded-full backdrop-blur-sm border border-white/15">
            {/* User Tab: Live Feed */}
            <button
              onClick={() => {
                onSelectView?.('feed');
                onSelectUserTab?.('feed');
              }}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'feed' && userTab === 'feed'
                  ? 'bg-white text-[#003bbe] shadow-sm font-bold'
                  : 'text-white hover:bg-white/15'
              }`}
            >
              Live Issues
            </button>

            {/* User Tab: Resolved History */}
            <button
              onClick={() => {
                onSelectView?.('feed');
                onSelectUserTab?.('resolved');
              }}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'feed' && userTab === 'resolved'
                  ? 'bg-white text-[#003bbe] shadow-sm font-bold'
                  : 'text-white hover:bg-white/15'
              }`}
            >
              Resolved History
            </button>

            {/* Admin Suite Tab (Only for Admin/Co-Admin/Founder) */}
            {isAdminOrHigher && (
              <button
                onClick={() => onSelectView?.('admin')}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeView === 'admin'
                    ? 'bg-white text-[#003bbe] shadow-sm font-bold'
                    : 'text-white hover:bg-white/15'
                }`}
              >
                Admin Suite
              </button>
            )}

            {/* Worker Tasks Tab (Only for Worker) */}
            {isWorker && (
              <button
                onClick={() => onSelectView?.('worker')}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeView === 'worker'
                    ? 'bg-white text-[#003bbe] shadow-sm font-bold'
                    : 'text-white hover:bg-white/15'
                }`}
              >
                Worker Tasks
              </button>
            )}
          </nav>
        )}

        {/* Right Section: Campus Switcher + Action CTA + Auth */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Campus Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-xs text-white transition cursor-pointer"
              title="Switch Campus"
            >
              <Layers className="w-3.5 h-3.5 text-white/90" />
              <span className="hidden sm:inline max-w-[100px] truncate">
                {currentCampus ? currentCampus.name : 'Campuses'}
              </span>
              <ChevronDown className="w-3 h-3 text-white/80" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white text-[#131b2e] border border-blue-100 shadow-2xl p-2.5 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Campus Directory
                </div>
                <button
                  onClick={() => {
                    onSelectCampus(null);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                    !currentCampus ? 'bg-[#eaedff] text-[#003bbe] font-bold' : 'hover:bg-slate-50'
                  }`}
                >
                  <span>Main Landing & Register</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </button>
                <div className="my-1.5 border-t border-slate-100"></div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {campusesList.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400">No campuses registered yet.</div>
                  ) : (
                    campusesList.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          onSelectCampus(c.slug);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                          currentCampus?.slug === c.slug
                            ? 'bg-[#eaedff] text-[#003bbe] font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="font-semibold truncate">{c.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{c.slug}.campusconnect.com</div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize shrink-0">
                          {c.type.replace('_', ' ')}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Raise Issue Button (if in a campus) */}
          {currentCampus && (
            <button
              onClick={onOpenRaiseModal}
              className="flex items-center gap-1 rounded-full bg-white text-[#003bbe] px-3.5 sm:px-4 py-1.5 text-xs font-bold hover:bg-blue-50 transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#003bbe]" />
              <span className="hidden sm:inline">Raise Issue</span>
            </button>
          )}

          {/* User Status / Auth Buttons */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-white/80 font-medium">
                  {ROLE_COLORS[currentUser.role]?.label || currentUser.role}
                </span>
              </div>

              <button
                onClick={onLogout}
                className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenAuth('login')}
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-white hover:bg-white/15 transition cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-white text-[#003bbe] hover:bg-blue-50 shadow-sm transition cursor-pointer"
              >
                Join
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
