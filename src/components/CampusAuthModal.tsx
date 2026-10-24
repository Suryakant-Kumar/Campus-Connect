import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  Building2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { loginUser, registerUser } from '../api';
import { Campus, User } from '../types';

interface CampusAuthModalProps {
  campus: Campus | null;
  initialMode: 'login' | 'register' | 'founder';
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User, campus: Campus | null) => void;
}

export const CampusAuthModal: React.FC<CampusAuthModalProps> = ({
  campus,
  initialMode,
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'founder'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login' || mode === 'founder') {
        const res = await loginUser({
          email: email.trim(),
          password,
          campusSlug: campus ? campus.slug : undefined,
        });
        onAuthSuccess(res.user, res.campus);
        onClose();
      } else {
        if (!campus) {
          throw new Error('Campus context required for registration.');
        }
        const res = await registerUser({
          email: email.trim(),
          password,
          name: name.trim(),
          campusSlug: campus.slug,
          department: department.trim() || undefined,
          phone: phone.trim() || undefined,
        });
        onAuthSuccess(res.user, res.campus);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white border border-[#dae2fd] rounded-2xl md:rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden text-[#131b2e]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#eaedff]">
          <div>
            <h3 className="font-headline font-bold text-lg text-[#131b2e] flex items-center gap-2">
              {mode === 'founder' ? (
                <>
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  <span>Global Founder Login</span>
                </>
              ) : mode === 'register' ? (
                <>
                  <Building2 className="w-5 h-5 text-[#003bbe]" />
                  <span>Join {campus ? campus.name : 'Campus'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5 text-[#003bbe]" />
                  <span>Sign In · {campus ? campus.name : 'CampusConnect'}</span>
                </>
              )}
            </h3>
            {campus && (
              <p className="text-[11px] font-mono text-[#003bbe] mt-0.5">
                {campus.slug}.campusconnect.com
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[#ba1a1a] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#ba1a1a] shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5 text-xs">
          {mode === 'register' && (
            <div>
              <label className="block text-[#131b2e] font-bold mb-1">Full Name *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Lin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-[#131b2e] outline-none focus:bg-white focus:border-[#003bbe]"
                />
                <UserIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[#131b2e] font-bold mb-1">Email Address *</label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="user@campus.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-[#131b2e] outline-none focus:bg-white focus:border-[#003bbe]"
              />
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-[#131b2e] font-bold mb-1">Password * (scrypt hashed)</label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={6}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-[#131b2e] outline-none focus:bg-white focus:border-[#003bbe]"
              />
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#131b2e] font-bold mb-1">Department / Room</label>
                <input
                  type="text"
                  placeholder="e.g. Nilgiri Wing B"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-[#131b2e] outline-none focus:bg-white focus:border-[#003bbe]"
                />
              </div>

              <div>
                <label className="block text-[#131b2e] font-bold mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-[#131b2e] outline-none focus:bg-white focus:border-[#003bbe]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-[#003bbe] hover:bg-[#1150ef] disabled:opacity-50 text-white font-bold shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : mode === 'register' ? (
              <>
                <span>Create Resident Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer switch */}
        <div className="mt-4 pt-3 border-t border-[#eaedff] flex items-center justify-between text-xs text-[#434656]">
          {mode === 'login' ? (
            campus && (
              <>
                <span>Don't have an account on this campus?</span>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-[#003bbe] hover:underline font-bold cursor-pointer"
                >
                  Sign Up
                </button>
              </>
            )
          ) : mode === 'register' ? (
            <>
              <span>Already registered?</span>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-[#003bbe] hover:underline font-bold cursor-pointer"
              >
                Sign In
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-[#003bbe] hover:underline font-bold cursor-pointer"
            >
              Back to Campus Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
