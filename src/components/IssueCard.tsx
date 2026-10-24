import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  MessageSquare,
  MapPin,
  Clock,
  Sparkles,
  AlertOctagon,
  CheckCircle2,
  Hourglass,
  XCircle,
  ShieldAlert,
  Wrench,
  Camera,
} from 'lucide-react';
import { Issue, IssueStatus, IssueUrgency, User } from '../types';

interface IssueCardProps {
  issue: Issue;
  currentUser: User | null;
  onUpvote: (issueId: string) => void;
  onOpenDetails: (issue: Issue) => void;
}

const STATUS_CONFIG: Record<
  IssueStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  open: {
    label: 'Open',
    bg: 'bg-blue-50',
    text: 'text-[#003bbe]',
    border: 'border-blue-200',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  resolved: {
    label: 'Resolved',
    bg: 'bg-emerald-50',
    text: 'text-[#005539]',
    border: 'border-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-50',
    text: 'text-[#ba1a1a]',
    border: 'border-rose-200',
  },
};

const URGENCY_CONFIG: Record<
  IssueUrgency,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  critical: {
    label: 'Critical Hazard',
    bg: 'bg-[#ffdad6]',
    text: 'text-[#93000a]',
    border: 'border-rose-300',
    dot: 'bg-[#ba1a1a]',
  },
  high: {
    label: 'High Priority',
    bg: 'bg-amber-100',
    text: 'text-amber-900',
    border: 'border-amber-300',
    dot: 'bg-amber-600',
  },
  medium: {
    label: 'Medium',
    bg: 'bg-[#eaedff]',
    text: 'text-[#00397f]',
    border: 'border-blue-200',
    dot: 'bg-[#2a5caf]',
  },
  low: {
    label: 'Low',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
};

export const IssueCard: React.FC<IssueCardProps> = ({
  issue,
  currentUser,
  onUpvote,
  onOpenDetails,
}) => {
  const [upvoting, setUpvoting] = useState(false);
  const statusInfo = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;
  const urgencyInfo = URGENCY_CONFIG[issue.urgency] || URGENCY_CONFIG.medium;

  const handleUpvoteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    setUpvoting(true);
    try {
      await onUpvote(issue.id);
    } finally {
      setUpvoting(false);
    }
  };

  return (
    <article
      onClick={() => onOpenDetails(issue)}
      className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md border border-[#eef4ff] hover:border-[#b9cffd] transition-all duration-200 cursor-pointer flex flex-col sm:flex-row gap-4 items-start group relative"
    >
      {/* Reddit-Style Upvote Pill Module */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex sm:flex-col items-center justify-center bg-[#f2f3ff] rounded-full px-3 py-1 sm:py-2.5 gap-1 shrink-0 group-hover:bg-[#dde1ff]/70 transition-colors border border-[#dae2fd]/50"
      >
        <button
          aria-label="Upvote Issue"
          onClick={handleUpvoteClick}
          disabled={!currentUser || upvoting}
          className={`flex items-center justify-center w-7 h-7 rounded-full hover:bg-white transition-colors cursor-pointer ${
            issue.has_upvoted ? 'text-[#003bbe] bg-white shadow-xs' : 'text-slate-600 hover:text-[#003bbe]'
          } ${!currentUser ? 'opacity-60 cursor-not-allowed' : ''}`}
          title={currentUser ? 'Upvote this issue' : 'Sign in to upvote'}
        >
          <ChevronUp className="w-5 h-5 leading-none" />
        </button>

        <span className="font-semibold text-xs text-[#003bbe] tabular-nums font-mono px-1">
          {issue.upvotes_count || 0}
        </span>

        <button
          aria-label="Downvote/Details"
          onClick={() => onOpenDetails(issue)}
          className="flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
        >
          <ChevronDown className="w-5 h-5 leading-none" />
        </button>
      </div>

      {/* Issue Body */}
      <div className="flex-1 min-w-0">
        {/* Header tags: Urgency, Category, Time */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${urgencyInfo.bg} ${urgencyInfo.text} border ${urgencyInfo.border}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${urgencyInfo.dot}`}></span>
            {urgencyInfo.label}
          </span>

          <span className="px-2.5 py-0.5 rounded-full bg-[#eaedff] text-[#00397f] font-semibold text-[11px]">
            {issue.category}
          </span>

          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
          >
            {statusInfo.label}
          </span>

          <span className="text-slate-300 text-xs">·</span>
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            {new Date(issue.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-headline font-bold text-base sm:text-lg text-[#131b2e] group-hover:text-[#003bbe] transition-colors leading-snug">
          {issue.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-[#434656] mt-1.5 line-clamp-2 leading-relaxed">
          {issue.description}
        </p>

        {/* AI Triage Banner if available */}
        {issue.ai_analysis && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-[#f2f3ff] border border-[#dae2fd] flex items-start gap-2 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#003bbe] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-slate-700">
                <span className="font-semibold text-[#003bbe] text-[11px]">
                  AI Triage · Clarity {issue.ai_analysis.clarityScore}/10
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {issue.ai_analysis.aiProvider === 'gemini' ? 'Gemini 2.5 Flash' : 'NLP Engine'}
                </span>
              </div>
              <p className="text-slate-600 line-clamp-1 mt-0.5 text-xs">
                {issue.ai_analysis.actionableSummary}
              </p>
            </div>
          </div>
        )}

        {/* AI Flag Alert */}
        {issue.ai_flagged && (
          <div className="mt-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-[#ba1a1a] text-xs flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-[#ba1a1a] shrink-0" />
            <span className="line-clamp-1">Safety Notice: {issue.ai_flag_reason || 'Flagged for review'}</span>
          </div>
        )}

        {/* Location & Photo Preview */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#434656] pt-2 border-t border-[#f2f3ff]">
          <div className="flex items-center gap-1.5 truncate max-w-[280px]">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{issue.location}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {issue.photo_url && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#003bbe] bg-[#eaedff] px-2 py-0.5 rounded-full font-medium">
                <Camera className="w-3 h-3" />
                <span>Photo</span>
              </span>
            )}

            <div className="flex items-center gap-1 text-slate-500 font-medium">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span className="tabular-nums font-mono">{issue.comments_count || 0}</span>
            </div>
          </div>
        </div>

        {/* Assigned Worker / Resolved Callout */}
        {issue.status === 'resolved' ? (
          <div className="mt-2.5 p-2.5 rounded-xl bg-[#6af7b9]/20 border border-[#00704c]/20 text-[#005539] text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className="w-4 h-4 text-[#00704c] shrink-0" />
              <span className="font-semibold truncate">
                Fixed by: <strong className="font-bold">{issue.worker_name || 'Campus Technician'}{issue.worker_department ? `, ${issue.worker_department}` : ''}</strong>
              </span>
            </div>
            <span className="text-[11px] text-[#005539] shrink-0 font-medium font-mono">
              {new Date(issue.resolved_at || issue.updated_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        ) : issue.worker_name ? (
          <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 inline-flex items-center gap-1.5">
            <Wrench className="w-3 h-3 text-amber-600" />
            <span>Assigned: <strong>{issue.worker_name}</strong></span>
          </div>
        ) : null}
      </div>
    </article>
  );
};
