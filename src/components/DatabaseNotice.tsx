import React, { useState } from 'react';
import { Database, AlertTriangle, Copy, Check, ChevronDown, ChevronUp, Terminal } from 'lucide-react';

interface DatabaseNoticeProps {
  dbConfigured: boolean;
  dbError?: string | null;
}

export const DatabaseNotice: React.FC<DatabaseNoticeProps> = ({ dbConfigured, dbError }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (dbConfigured && !dbError) {
    return null;
  }

  const sampleEnv = `# In your .env file or deployment environment:
DATABASE_URL="postgresql://user:password@ep-xyz-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
SESSION_SECRET="your-ultra-secure-random-secret-key-32chars"
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-3.8-flash"`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sampleEnv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-amber-300">
              {dbError ? 'PostgreSQL Notice: In-Memory Demo Mode Active' : 'PostgreSQL Database Connection'}
            </span>
            <p className="text-amber-200/80 text-xs mt-0.5">
              {dbError
                ? `${dbError}. In-memory mock data is active so you can fully explore, test, and use the platform.`
                : 'CampusConnect is running with active mock storage. Connect an external PostgreSQL instance (e.g. Neon) anytime via DATABASE_URL.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Connection Setup Guide</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-amber-500/20 text-xs text-slate-300 space-y-2">
          <p className="text-slate-300">
            1. Create a free PostgreSQL database at <a href="https://neon.tech" target="_blank" rel="noreferrer" className="text-amber-400 underline font-medium">neon.tech</a> or any standard PostgreSQL provider.
          </p>
          <p className="text-slate-300">
            2. Copy your connection URI with SSL enabled (<code className="text-amber-300 font-mono">?sslmode=require</code>) into your <code className="text-amber-300 font-mono">.env</code> file.
          </p>
          <div className="relative bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-300 overflow-x-auto">
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <div className="flex items-center gap-1.5 text-slate-500 mb-2 pb-1 border-b border-slate-800">
              <Terminal className="w-3.5 h-3.5" />
              <span>.env</span>
            </div>
            <pre>{sampleEnv}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
