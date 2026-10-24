import React, { useState } from 'react';
import {
  Wrench,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  Check,
  X,
  Radio,
  AlertOctagon,
} from 'lucide-react';
import { Issue, User, IssueStatus } from '../types';
import { updateIssueStatus } from '../api';

interface WorkerDashboardProps {
  currentUser: User;
  issues: Issue[];
  onOpenDetails: (issue: Issue) => void;
  onRefreshData: () => void;
}

export const WorkerDashboard: React.FC<WorkerDashboardProps> = ({
  currentUser,
  issues,
  onOpenDetails,
  onRefreshData,
}) => {
  const [filter, setFilter] = useState<'active' | 'resolved'>('active');
  const [solvingIssueId, setSolvingIssueId] = useState<string | null>(null);
  const [solveNote, setSolveNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [dutyActive, setDutyActive] = useState<boolean>(true);

  // STRICT REQUIREMENT: Assigned jobs only!
  const myAssignedJobs = issues.filter((i) => i.assigned_to === currentUser.id);
  const activeJobs = myAssignedJobs.filter((i) => i.status !== 'resolved' && i.status !== 'rejected');
  const resolvedJobs = myAssignedJobs.filter((i) => i.status === 'resolved');

  const displayedJobs = filter === 'active' ? activeJobs : resolvedJobs;

  const handleStartSolve = (issue: Issue, e: React.MouseEvent) => {
    e.stopPropagation();
    setSolvingIssueId(issue.id);
    setSolveNote(issue.resolution_notes || '');
  };

  const handleConfirmSolve = async (issueId: string) => {
    setSubmitting(true);
    try {
      await updateIssueStatus(issueId, {
        status: 'resolved',
        resolutionNotes: solveNote.trim() || 'Marked as resolved by field worker.',
      });
      setSolvingIssueId(null);
      setSolveNote('');
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to mark ticket as solved');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartJob = async (issueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateIssueStatus(issueId, { status: 'in_progress' });
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to start job');
    }
  };

  // Initials for avatar
  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Top Worker Overview & Shift Bar (Stitch Image 18 Spec) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003bbe] via-[#1150ef] to-[#2a5caf] p-6 text-white shadow-xl">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-emerald-400/15 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-white text-[#003bbe] flex items-center justify-center shadow-lg font-headline font-bold text-xl">
                {initials}
              </div>
              <span
                className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                  dutyActive ? 'bg-[#6ffbbe]' : 'bg-slate-400'
                }`}
                title={dutyActive ? 'On Duty' : 'Off Duty'}
              ></span>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest text-[#d8e2ff] bg-white/15 px-2.5 py-0.5 rounded-full font-mono font-bold">
                  Staff ID: #{currentUser.id.substring(0, 6)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[#6ffbbe] font-bold bg-[#005539]/60 px-2.5 py-0.5 rounded-full">
                  {currentUser.department || 'Lead Maintenance'}
                </span>
              </div>
              <h1 className="font-headline font-bold text-2xl sm:text-3xl text-white tracking-tight mt-1">
                {currentUser.name}
              </h1>
              <p className="text-xs text-[#d8e2ff]">
                Estate Maintenance Division · Field Dispatch Console
              </p>
            </div>
          </div>

          {/* Duty Mode Toggle */}
          <div className="flex items-center gap-3 bg-white/15 backdrop-blur-md rounded-full px-4 py-2 border border-white/20 self-start lg:self-auto shadow-inner">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  dutyActive ? 'bg-[#6ffbbe] animate-ping' : 'bg-slate-400'
                }`}
              ></div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-[#d8e2ff] font-bold tracking-wider">
                  Duty Status
                </span>
                <span className="text-xs font-bold text-white">
                  {dutyActive ? 'Available for Emergency Dispatch' : 'Off Duty'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setDutyActive(!dutyActive)}
              className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                dutyActive ? 'bg-[#00704c]' : 'bg-slate-500'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                  dutyActive ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Quick Performance Micro-Metrics Strip */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-white/15">
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs">
            <span className="text-[10px] text-[#d8e2ff] uppercase font-bold tracking-wider block">
              Active Orders
            </span>
            <span className="font-headline font-bold text-xl text-white">
              {activeJobs.length} Assigned
            </span>
          </div>

          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs">
            <span className="text-[10px] text-[#d8e2ff] uppercase font-bold tracking-wider block">
              Resolved Work
            </span>
            <span className="font-headline font-bold text-xl text-white">
              {resolvedJobs.length} Completed
            </span>
          </div>

          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs">
            <span className="text-[10px] text-[#d8e2ff] uppercase font-bold tracking-wider block">
              SLA Compliance
            </span>
            <span className="font-headline font-bold text-xl text-[#6ffbbe]">
              98.4% On-Time
            </span>
          </div>

          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs">
            <span className="text-[10px] text-[#d8e2ff] uppercase font-bold tracking-wider block">
              Dispatched Zone
            </span>
            <span className="font-headline font-bold text-xl text-white truncate block">
              Campus Central
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher: Assigned Active vs Completed */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-[#eaedff]">
        <div>
          <h2 className="font-headline font-bold text-lg text-[#131b2e]">
            Assigned Task Queue
          </h2>
          <p className="text-xs text-[#434656]">
            Showing jobs specifically assigned to you by campus administration
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#eaedff] rounded-full">
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              filter === 'active'
                ? 'bg-white text-[#003bbe] shadow-sm'
                : 'text-[#434656] hover:text-[#131b2e]'
            }`}
          >
            Active Tasks ({activeJobs.length})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              filter === 'resolved'
                ? 'bg-white text-[#003bbe] shadow-sm'
                : 'text-[#434656] hover:text-[#131b2e]'
            }`}
          >
            Resolved ({resolvedJobs.length})
          </button>
        </div>
      </div>

      {/* Solving Note Dialog Modal */}
      {solvingIssueId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#dae2fd] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-[#005539] font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-[#00704c]" />
                <span className="font-headline font-bold text-base">Mark as Solved</span>
              </div>
              <button
                onClick={() => setSolvingIssueId(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#434656]">
              Confirm that this issue has been repaired and verified. You can include an optional note describing the fix for students and campus records.
            </p>

            <div>
              <label className="block text-xs font-bold text-[#131b2e] mb-1.5">
                Note about what was broken or fixed (optional):
              </label>
              <textarea
                rows={3}
                value={solveNote}
                onChange={(e) => setSolveNote(e.target.value)}
                placeholder="e.g. Replaced faulty 40W copper coil and reset thermal cutoff switch; hot water restored."
                className="w-full px-3 py-2 rounded-xl bg-[#f2f3ff] border border-[#c3c5d8] text-xs text-[#131b2e] outline-none focus:bg-white focus:border-[#003bbe] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSolvingIssueId(null)}
                className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleConfirmSolve(solvingIssueId)}
                className="px-5 py-2 rounded-full bg-[#00704c] hover:bg-[#005539] disabled:opacity-50 text-white text-xs font-bold shadow-md cursor-pointer transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{submitting ? 'Saving...' : 'Confirm & Mark as Solved'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assigned Jobs List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayedJobs.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-[#434656] bg-[#f2f3ff] rounded-2xl border border-dashed border-[#c3c5d8] space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="font-headline font-bold text-base text-[#131b2e]">
              {filter === 'active' ? 'No Active Jobs Assigned' : 'No Completed Jobs Yet'}
            </div>
            <p className="max-w-xs mx-auto text-xs text-[#434656]">
              {filter === 'active'
                ? 'You currently have no pending tasks assigned by the campus admin. Check back later.'
                : 'Tasks you mark as solved will appear here in your verified completion log.'}
            </p>
          </div>
        ) : (
          displayedJobs.map((issue) => (
            <div
              key={issue.id}
              onClick={() => onOpenDetails(issue)}
              className="p-5 rounded-2xl bg-white border border-[#dae2fd] hover:border-[#003bbe]/40 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md"
            >
              <div className="space-y-2">
                {/* Category & Urgency */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#00397f] bg-[#eaedff] px-2.5 py-0.5 rounded-full">
                    {issue.category}
                  </span>
                  <span
                    className={`font-bold uppercase text-[10px] px-2.5 py-0.5 rounded-full ${
                      issue.urgency === 'critical'
                        ? 'bg-[#ffdad6] text-[#93000a] border border-rose-300'
                        : issue.urgency === 'high'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-[#eaedff] text-[#00397f]'
                    }`}
                  >
                    {issue.urgency}
                  </span>
                </div>

                <h3 className="font-headline font-bold text-base text-[#131b2e] line-clamp-2">
                  {issue.title}
                </h3>
                <p className="text-xs text-[#434656] line-clamp-2 leading-relaxed">
                  {issue.description}
                </p>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-xs text-[#434656] pt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#003bbe] shrink-0" />
                  <span className="font-medium truncate">{issue.location}</span>
                </div>

                {/* AI Summary */}
                {issue.ai_analysis && (
                  <div className="p-2.5 rounded-xl bg-[#f2f3ff] text-xs text-[#434656] border border-[#dae2fd]">
                    <span className="text-[#003bbe] font-bold block text-[10px] uppercase tracking-wider mb-0.5">
                      Action Required:
                    </span>
                    <p className="line-clamp-2 leading-relaxed">
                      {issue.ai_analysis.actionableSummary}
                    </p>
                  </div>
                )}

                {/* If Resolved: Show who fixed it and notes */}
                {issue.status === 'resolved' && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                    <div className="text-[#005539] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00704c]" />
                      <span>Fixed by you on {new Date(issue.resolved_at || issue.updated_at).toLocaleDateString()}</span>
                    </div>
                    {issue.resolution_notes && (
                      <p className="text-[11px] text-[#434656] pt-0.5 line-clamp-2">
                        "{issue.resolution_notes}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#f2f3ff] flex items-center justify-between gap-2">
                <span
                  className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                    issue.status === 'in_progress'
                      ? 'bg-amber-100 text-amber-800'
                      : issue.status === 'resolved'
                      ? 'bg-emerald-100 text-[#005539]'
                      : 'bg-blue-100 text-[#003bbe]'
                  }`}
                >
                  {issue.status.replace('_', ' ')}
                </span>

                <div className="flex items-center gap-2">
                  {issue.status === 'open' && (
                    <button
                      onClick={(e) => handleStartJob(issue.id, e)}
                      className="px-3 py-1 rounded-full bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-xs font-bold cursor-pointer transition"
                    >
                      Start Work
                    </button>
                  )}

                  {issue.status !== 'resolved' && (
                    <button
                      onClick={(e) => handleStartSolve(issue, e)}
                      className="px-3.5 py-1.5 rounded-full bg-[#00704c] hover:bg-[#005539] text-white font-bold text-xs shadow-sm cursor-pointer transition flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark as solved</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
