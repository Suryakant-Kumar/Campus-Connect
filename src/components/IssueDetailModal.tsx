import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MapPin,
  Sparkles,
  ChevronUp,
  Send,
  Lock,
  Wrench,
  CheckCircle2,
  Clock,
  Radio,
  Camera,
  AlertTriangle,
} from 'lucide-react';
import { Issue, IssueComment, IssueStatus, StaffMember, User } from '../types';
import {
  getIssueComments,
  postIssueComment,
  toggleIssueUpvote,
  updateIssueStatus,
  assignIssueWorker,
  uploadPhotoOnline,
} from '../api';

interface IssueDetailModalProps {
  issue: Issue;
  currentUser: User | null;
  staffList: StaffMember[];
  isOpen: boolean;
  onClose: () => void;
  onIssueUpdated: (updated: Issue) => void;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue,
  currentUser,
  staffList,
  isOpen,
  onClose,
  onIssueUpdated,
}) => {
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);

  // Status & resolution states
  const [newStatus, setNewStatus] = useState<IssueStatus>(issue.status);
  const [resolutionNotes, setResolutionNotes] = useState(issue.resolution_notes || '');
  const [resolutionPhotoUrl, setResolutionPhotoUrl] = useState<string | null>(
    issue.resolution_photo_url || null
  );
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(issue.assigned_to || '');
  const [assigningWorker, setAssigningWorker] = useState(false);

  const commentsEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const isStaff = currentUser && ['worker', 'co_admin', 'admin', 'founder'].includes(currentUser.role);
  const canAssign = currentUser && ['co_admin', 'admin', 'founder'].includes(currentUser.role);
  const workersOnly = staffList.filter((s) => s.role === 'worker');

  // Fetch comments and poll every 4 seconds
  useEffect(() => {
    let isMounted = true;

    const fetchComments = async () => {
      try {
        const data = await getIssueComments(issue.id);
        if (isMounted) {
          setComments(data);
        }
      } catch (err) {
        console.error('Failed to poll comments:', err);
      }
    };

    fetchComments();
    const interval = setInterval(fetchComments, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [issue.id]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;

    setCommentLoading(true);
    try {
      const added = await postIssueComment(issue.id, newComment.trim(), isInternalComment);
      setComments((prev) => [...prev, added]);
      setNewComment('');
      setIsInternalComment(false);
      onIssueUpdated({
        ...issue,
        comments_count: (issue.comments_count || 0) + 1,
      });
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleToggleUpvote = async () => {
    if (!currentUser) return;
    try {
      const res = await toggleIssueUpvote(issue.id);
      onIssueUpdated({
        ...issue,
        has_upvoted: res.hasUpvoted,
        upvotes_count: res.upvotesCount,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to toggle upvote');
    }
  };

  const handleStatusUpdate = async () => {
    setUpdatingStatus(true);
    try {
      const res = await updateIssueStatus(issue.id, {
        status: newStatus,
        resolutionNotes: newStatus === 'resolved' ? resolutionNotes : undefined,
        resolutionPhotoUrl: newStatus === 'resolved' ? resolutionPhotoUrl || undefined : undefined,
      });
      onIssueUpdated({
        ...issue,
        status: res.issue.status,
        resolution_notes: res.issue.resolution_notes,
        resolution_photo_url: res.issue.resolution_photo_url,
        resolved_at: res.issue.resolved_at,
      });
      alert(`Issue status successfully updated to "${newStatus}".`);
    } catch (err: any) {
      alert(err.message || 'Failed to update issue status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleWorkerAssignment = async (workerId: string) => {
    setSelectedWorkerId(workerId);
    setAssigningWorker(true);
    try {
      const res = await assignIssueWorker(issue.id, workerId || null);
      const worker = staffList.find((s) => s.id === workerId);
      onIssueUpdated({
        ...issue,
        assigned_to: res.issue.assigned_to,
        status: res.issue.status,
        worker_name: worker ? worker.name : null,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to assign worker');
    } finally {
      setAssigningWorker(false);
    }
  };

  const handleResolutionPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await uploadPhotoOnline(reader.result as string, file.name);
        setResolutionPhotoUrl(res.url);
      } catch (err: any) {
        alert(err.message || 'Photo upload failed');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#dae2fd] rounded-2xl md:rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh] text-[#131b2e]">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#eaedff] flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-[#eaedff] text-[#00397f] text-xs font-bold">
              {issue.category}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                issue.status === 'resolved'
                  ? 'bg-emerald-100 text-[#005539] border border-emerald-300'
                  : issue.status === 'in_progress'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-blue-100 text-[#003bbe] border border-blue-200'
              }`}
            >
              {issue.status.replace('_', ' ')}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                issue.urgency === 'critical'
                  ? 'bg-[#ffdad6] text-[#93000a]'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {issue.urgency} Urgency
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Two columns on desktop */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#eaedff]">
          {/* Left Column: Issue details, AI analysis, Photos (7 cols) */}
          <div className="lg:col-span-7 p-6 space-y-6">
            <div>
              <h2 className="font-headline font-bold text-xl sm:text-2xl text-[#131b2e] leading-snug">
                {issue.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#434656]">
                <span className="flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-[#003bbe]" />
                  <span>{issue.location}</span>
                </span>
                <span>·</span>
                <span>Reported by {issue.creator_name || 'Campus Member'}</span>
                <span>·</span>
                <span>{new Date(issue.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#f2f3ff] text-xs sm:text-sm text-[#131b2e] leading-relaxed whitespace-pre-wrap border border-[#dae2fd]">
              {issue.description}
            </div>

            {/* Photo Attachment if present */}
            {issue.photo_url && (
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Attachment Proof:
                </span>
                <div className="rounded-2xl overflow-hidden border border-[#dae2fd] max-w-sm">
                  <img
                    src={issue.photo_url}
                    alt="Issue attachment"
                    className="w-full h-auto max-h-64 object-cover"
                  />
                </div>
              </div>
            )}

            {/* Gemini AI Triage Analysis Card */}
            {issue.ai_analysis && (
              <div className="p-4 rounded-2xl bg-[#f2f3ff] border border-[#dae2fd] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#003bbe] font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-[#003bbe]" />
                    <span>Gemini AI Safety & Triage Analysis</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded-full border border-[#c3c5d8]">
                    {issue.ai_analysis.aiProvider === 'gemini' ? 'Gemini 2.5 Flash' : 'NLP Engine'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-[#dae2fd]">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Clarity Score</span>
                    <span className="font-headline font-bold text-base text-[#131b2e]">
                      {issue.ai_analysis.clarityScore} / 10
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-[#dae2fd]">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Inferred Urgency</span>
                    <span className="font-headline font-bold text-base text-amber-800 capitalize">
                      {issue.ai_analysis.urgency}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                    Actionable Worker Summary:
                  </span>
                  <p className="text-xs text-[#434656] bg-white p-3 rounded-xl border border-[#dae2fd] leading-relaxed">
                    {issue.ai_analysis.actionableSummary}
                  </p>
                </div>
              </div>
            )}

            {/* Resolved Status Card if already resolved */}
            {issue.status === 'resolved' && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                  <div className="flex items-center gap-2 text-[#005539] font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#00704c]" />
                    <span>Issue Verified & Solved</span>
                  </div>
                  <span className="text-[11px] text-[#005539] font-mono font-medium">
                    {new Date(issue.resolved_at || issue.updated_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-emerald-200 text-xs space-y-1">
                  <div className="text-[#131b2e] font-semibold flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-[#00704c]" />
                    <span>
                      Fixed by:{' '}
                      <strong className="text-[#005539] font-bold">
                        {issue.worker_name || 'Campus Technician'}
                        {issue.worker_department ? `, ${issue.worker_department}` : ''}
                      </strong>
                    </span>
                  </div>
                  {issue.resolution_notes && (
                    <div className="text-[#434656] pt-1 leading-relaxed border-t border-slate-100 mt-1">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">
                        Repair Details:
                      </span>
                      <span>"{issue.resolution_notes}"</span>
                    </div>
                  )}
                </div>

                {issue.resolution_photo_url && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-emerald-200 max-w-xs">
                    <img
                      src={issue.resolution_photo_url}
                      alt="Resolution proof"
                      className="w-full h-auto max-h-48 object-cover"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Staff Resolution & Assignment Controls (Workers, Co-Admins, Admins) */}
            {isStaff && (
              <div className="p-4 rounded-2xl bg-[#f2f3ff] border border-[#dae2fd] space-y-4">
                <div className="flex items-center justify-between border-b border-[#dae2fd] pb-2">
                  <h4 className="text-xs font-bold text-[#131b2e] flex items-center gap-1.5 uppercase tracking-wider">
                    <Wrench className="w-3.5 h-3.5 text-[#003bbe]" />
                    <span>Staff Controls</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 capitalize font-medium">
                    Role: {currentUser?.role}
                  </span>
                </div>

                {/* Worker Assigner (Co-Admin & Admin only) */}
                {canAssign && (
                  <div>
                    <label className="block text-xs font-bold text-[#131b2e] mb-1">
                      Assign Worker
                    </label>
                    <select
                      value={selectedWorkerId}
                      onChange={(e) => handleWorkerAssignment(e.target.value)}
                      disabled={assigningWorker}
                      className="w-full px-3 py-2 rounded-full bg-white border border-[#c3c5d8] text-[#131b2e] text-xs font-medium outline-none focus:border-[#003bbe]"
                    >
                      <option value="">-- Unassigned (In queue) --</option>
                      {workersOnly.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} {w.department ? `(${w.department})` : ''} - {w.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status Switcher & Resolution details */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#131b2e] mb-1">
                      Update Ticket Status
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['open', 'in_progress', 'resolved', 'rejected'] as IssueStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setNewStatus(st)}
                          className={`py-1.5 px-2 rounded-full text-xs font-bold capitalize border transition cursor-pointer ${
                            newStatus === st
                              ? 'bg-[#003bbe] text-white border-[#003bbe] shadow-xs'
                              : 'bg-white text-[#434656] border-[#c3c5d8] hover:text-black'
                          }`}
                        >
                          {st.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {newStatus === 'resolved' && (
                    <div className="space-y-2 pt-2 border-t border-[#dae2fd]">
                      <div>
                        <label className="block text-xs font-bold text-[#131b2e] mb-1">
                          Resolution Notes *
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Explain what was broken or fixed..."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#c3c5d8] text-[#131b2e] text-xs outline-none focus:border-[#003bbe] resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#131b2e] mb-1">
                          Proof of Resolution Photo
                        </label>
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          onChange={handleResolutionPhotoUpload}
                          className="hidden"
                        />
                        {resolutionPhotoUrl ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={resolutionPhotoUrl}
                              alt="Proof preview"
                              className="w-16 h-16 object-cover rounded-xl border border-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => setResolutionPhotoUrl(null)}
                              className="text-xs text-rose-600 hover:underline cursor-pointer"
                            >
                              Remove photo
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3.5 py-1.5 rounded-full bg-white border border-[#c3c5d8] hover:bg-slate-50 text-xs text-[#131b2e] font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5 text-[#003bbe]" />
                            <span>Attach after-repair photo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleStatusUpdate}
                    disabled={updatingStatus}
                    className="w-full py-2.5 rounded-full bg-[#003bbe] hover:bg-[#1150ef] disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    {updatingStatus ? 'Updating ticket...' : 'Confirm Status Change'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Discussion / Chat Thread (5 cols) */}
          <div className="lg:col-span-5 flex flex-col h-full bg-[#f8faff]">
            <div className="p-4 border-b border-[#eaedff] flex items-center justify-between shrink-0 bg-white">
              <h3 className="font-headline font-bold text-[#131b2e] text-sm flex items-center gap-2">
                <span>Discussion & Updates</span>
                <span className="px-2 py-0.2 rounded-full bg-[#eaedff] text-[#00397f] text-[10px] font-mono font-bold">
                  {comments.length}
                </span>
              </h3>

              {/* Upvote button */}
              <button
                onClick={handleToggleUpvote}
                disabled={!currentUser}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
                  issue.has_upvoted
                    ? 'bg-[#dde1ff] text-[#001452] border-blue-300'
                    : 'bg-white text-slate-700 border-[#c3c5d8] hover:bg-slate-50'
                }`}
              >
                <ChevronUp className="w-4 h-4 text-[#003bbe]" />
                <span className="tabular-nums font-mono">{issue.upvotes_count || 0} Upvotes</span>
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[300px] max-h-[480px]">
              {comments.length === 0 ? (
                <div className="text-center py-12 text-[#434656] text-xs">
                  No comments yet. Start the conversation!
                </div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-2xl text-xs space-y-1 ${
                      c.is_internal
                        ? 'bg-amber-50 border border-amber-200 text-amber-900'
                        : c.user_id === currentUser?.id
                        ? 'bg-[#eaedff] border border-blue-200 text-[#131b2e]'
                        : 'bg-white border border-[#dae2fd] text-[#131b2e] shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#131b2e]">{c.user_name}</span>
                        <span
                          className={`px-2 py-0.2 rounded-full text-[9px] uppercase font-bold ${
                            c.user_role === 'admin'
                              ? 'bg-indigo-100 text-indigo-900'
                              : c.user_role === 'worker'
                              ? 'bg-amber-100 text-amber-900'
                              : c.user_role === 'co_admin'
                              ? 'bg-cyan-100 text-cyan-900'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {c.user_role}
                        </span>
                        {c.is_internal && (
                          <span className="flex items-center gap-0.5 text-[9px] text-amber-700 font-bold">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Staff Note</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="leading-relaxed whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Comment Form */}
            {currentUser ? (
              <form onSubmit={handlePostComment} className="p-4 border-t border-[#eaedff] shrink-0 space-y-2 bg-white">
                {isStaff && (
                  <label className="flex items-center gap-2 text-[11px] text-[#434656] select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternalComment}
                      onChange={(e) => setIsInternalComment(e.target.checked)}
                      className="rounded text-[#003bbe] focus:ring-[#003bbe]"
                    />
                    <span className="flex items-center gap-1 text-amber-800 font-medium">
                      <Lock className="w-3 h-3 text-amber-600" />
                      <span>Internal staff note (hidden from regular residents)</span>
                    </span>
                  </label>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={
                      isInternalComment
                        ? 'Type internal staff note...'
                        : 'Post an update or question...'
                    }
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] focus:bg-white focus:border-[#003bbe] text-[#131b2e] text-xs outline-none"
                  />
                  <button
                    type="submit"
                    disabled={commentLoading || !newComment.trim()}
                    className="p-2 rounded-full bg-[#003bbe] hover:bg-[#1150ef] disabled:opacity-50 text-white transition cursor-pointer shadow-xs"
                    title="Send comment"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-4 border-t border-[#eaedff] text-center text-xs text-slate-400 bg-white">
                Sign in to post updates or comments on this issue.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
