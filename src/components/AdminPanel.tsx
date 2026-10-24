import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserPlus,
  Trash2,
  XCircle,
  Filter,
  Search,
  Building2,
  RefreshCw,
  AlertOctagon,
} from 'lucide-react';
import { Campus, StaffMember, User, Issue, IssueStatus } from '../types';
import {
  getCampusStaff,
  getCampusMembers,
  addCampusStaff,
  removeCampusStaff,
  updateMemberRole,
  updateIssueStatus,
  assignIssueWorker,
} from '../api';

interface AdminPanelProps {
  campus: Campus;
  currentUser: User;
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  onRefreshData: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  campus,
  currentUser,
  issues,
  onSelectIssue,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'people'>('tickets');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ticketSearch, setTicketSearch] = useState<string>('');

  // People & Roles management
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'worker' as 'worker' | 'co_admin',
    department: 'Maintenance',
    phone: '',
  });
  const [addingStaff, setAddingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  // Quick Action Modals for tickets: Resolve / Reject
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    type: 'resolve' | 'reject';
    issue: Issue | null;
    note: string;
  }>({
    open: false,
    type: 'resolve',
    issue: null,
    note: '',
  });
  const [submittingAction, setSubmittingAction] = useState(false);

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'founder';
  const isCoAdminOrHigher = ['admin', 'co_admin', 'founder'].includes(currentUser.role);

  useEffect(() => {
    loadMembers();
  }, [campus.slug]);

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const data = await getCampusMembers(campus.slug).catch(async () => {
        return await getCampusStaff(campus.slug);
      });
      setMembers(data);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);
    setAddingStaff(true);

    try {
      await addCampusStaff(campus.slug, newStaffForm);
      await loadMembers();
      setShowAddStaffModal(false);
      setNewStaffForm({
        name: '',
        email: '',
        password: '',
        role: 'worker',
        department: 'Maintenance',
        phone: '',
      });
      onRefreshData();
    } catch (err: any) {
      setStaffError(err.message || 'Failed to add staff member.');
    } finally {
      setAddingStaff(false);
    }
  };

  const handleRemoveStaff = async (memberId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove staff member "${name}"?`)) return;

    try {
      await removeCampusStaff(campus.slug, memberId);
      await loadMembers();
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove staff member.');
    }
  };

  const handleRoleChange = async (memberId: string, name: string, newRole: string) => {
    try {
      await updateMemberRole(campus.slug, memberId, newRole);
      await loadMembers();
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to change role.');
    }
  };

  const handleWorkerAssign = async (issueId: string, workerId: string) => {
    try {
      await assignIssueWorker(issueId, workerId || null);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to assign worker');
    }
  };

  const handleConfirmTicketAction = async () => {
    if (!actionModal.issue) return;
    setSubmittingAction(true);
    try {
      const newStatus: IssueStatus = actionModal.type === 'resolve' ? 'resolved' : 'rejected';
      await updateIssueStatus(actionModal.issue.id, {
        status: newStatus,
        resolutionNotes:
          actionModal.note.trim() ||
          (actionModal.type === 'resolve'
            ? 'Resolved by campus administration.'
            : 'Rejected by campus administration.'),
      });
      setActionModal({ open: false, type: 'resolve', issue: null, note: '' });
      onRefreshData();
    } catch (err: any) {
      alert(err.message || `Failed to ${actionModal.type} ticket`);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Workers list for assignment dropdown
  const availableWorkers = members.filter((m) => m.role === 'worker');

  // Overview Numbers
  const totalTickets = issues.length;
  const openTickets = issues.filter((i) => i.status === 'open').length;
  const inProgressTickets = issues.filter((i) => i.status === 'in_progress').length;
  const resolvedTickets = issues.filter((i) => i.status === 'resolved').length;
  const rejectedTickets = issues.filter((i) => i.status === 'rejected').length;
  const criticalHazards = issues.filter(
    (i) => i.urgency === 'critical' && i.status !== 'resolved' && i.status !== 'rejected'
  ).length;

  // Filtered Tickets
  const filteredTickets = issues.filter((issue) => {
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
    const matchesSearch =
      ticketSearch.trim() === '' ||
      issue.title.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      issue.location.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      issue.category.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      (issue.creator_name && issue.creator_name.toLowerCase().includes(ticketSearch.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Admin Suite Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-[#eaedff]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dde1ff] text-[#001452] text-xs font-bold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-[#003bbe]"></span>
            <span>Estate Dispatch Operations</span>
          </div>
          <h1 className="font-headline font-bold text-2xl sm:text-3xl text-[#131b2e] tracking-tight">
            Campus Governance & Dispatch Console
          </h1>
          <p className="text-sm text-[#434656] mt-1">
            {campus.name} Physical Infrastructure Control Hub · <span className="font-mono text-xs text-[#003bbe]">{campus.slug}.campusconnect.com</span>
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-1 p-1 bg-[#eaedff] rounded-full self-start lg:self-auto">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'tickets'
                ? 'bg-white text-[#003bbe] shadow-sm'
                : 'text-[#434656] hover:text-[#131b2e]'
            }`}
          >
            All Tickets ({issues.length})
          </button>
          <button
            onClick={() => setActiveTab('people')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'people'
                ? 'bg-white text-[#003bbe] shadow-sm'
                : 'text-[#434656] hover:text-[#131b2e]'
            }`}
          >
            People & Roles ({members.length})
          </button>
        </div>
      </div>

      {/* KPI Overview Numbers: 4 Soft Sky Tint Cards (Stitch Spec) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="relative overflow-hidden rounded-2xl bg-[#f2f3ff] p-5 shadow-xs border border-[#dae2fd]/70 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#434656] mb-2">
            <span>Active Live Issues</span>
            <AlertOctagon className="w-4 h-4 text-[#003bbe]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline font-bold text-3xl text-[#131b2e]">
              {openTickets + inProgressTickets}
            </span>
            <span className="text-xs font-bold text-[#005539] bg-[#6ffbbe]/30 px-2 py-0.5 rounded-full">
              {openTickets} open
            </span>
          </div>
          <div className="mt-2 text-xs text-[#434656] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
            <span>{criticalHazards} critical hazard{criticalHazards !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="relative overflow-hidden rounded-2xl bg-[#f2f3ff] p-5 shadow-xs border border-[#dae2fd]/70 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#434656] mb-2">
            <span>In Progress Work</span>
            <Clock className="w-4 h-4 text-[#003bbe]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline font-bold text-3xl text-[#131b2e]">
              {inProgressTickets}
            </span>
            <span className="text-xs text-[#434656]">dispatched</span>
          </div>
          <div className="mt-2 text-xs text-[#434656]">
            Target SLA: &lt;4 hours
          </div>
        </div>

        {/* KPI 3 */}
        <div className="relative overflow-hidden rounded-2xl bg-[#f2f3ff] p-5 shadow-xs border border-[#dae2fd]/70 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#434656] mb-2">
            <span>Verified Solved</span>
            <CheckCircle2 className="w-4 h-4 text-[#005539]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline font-bold text-3xl text-[#131b2e]">
              {resolvedTickets}
            </span>
            <span className="text-xs font-bold text-[#005539] bg-[#6ffbbe]/30 px-2 py-0.5 rounded-full">
              {totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 100}%
            </span>
          </div>
          <div className="mt-2 text-xs text-[#434656]">
            {rejectedTickets} requests rejected
          </div>
        </div>

        {/* KPI 4 */}
        <div className="relative overflow-hidden rounded-2xl bg-[#f2f3ff] p-5 shadow-xs border border-[#dae2fd]/70 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#434656] mb-2">
            <span>Campus Personnel</span>
            <Users className="w-4 h-4 text-[#2a5caf]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline font-bold text-3xl text-[#131b2e]">
              {members.length}
            </span>
            <span className="text-xs text-[#434656]">registered</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[#434656]">
            <span className="px-2 py-0.5 rounded-full bg-white font-semibold text-[#003bbe]">
              {availableWorkers.length} Workers
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white font-semibold text-slate-700">
              {members.filter((m) => ['admin', 'co_admin'].includes(m.role)).length} Admins
            </span>
          </div>
        </div>
      </div>

      {/* TAB 1: ALL TICKETS (Assign worker, Mark resolved, Reject, Details) */}
      {activeTab === 'tickets' && (
        <div className="bg-white rounded-2xl border border-[#dae2fd] p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div>
              <h3 className="font-headline font-bold text-lg text-[#131b2e]">
                Dispatch Queue & Live Action
              </h3>
              <p className="text-xs text-[#434656]">
                Assign workers, confirm resolution notes, or reject out-of-scope issues
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  placeholder="Filter by title, room, wing..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-[#131b2e] text-xs outline-none focus:bg-white focus:border-[#003bbe]"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-[#131b2e] text-xs font-medium outline-none cursor-pointer"
              >
                <option value="all">All Statuses ({issues.length})</option>
                <option value="open">Open ({openTickets})</option>
                <option value="in_progress">In Progress ({inProgressTickets})</option>
                <option value="resolved">Resolved ({resolvedTickets})</option>
                <option value="rejected">Rejected ({rejectedTickets})</option>
              </select>

              <button
                onClick={onRefreshData}
                className="p-2 rounded-full bg-[#f2f3ff] hover:bg-[#eaedff] text-[#003bbe] transition cursor-pointer"
                title="Refresh list"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-[#f2f3ff]">
            {filteredTickets.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#434656]">
                No tickets match the selected criteria.
              </div>
            ) : (
              filteredTickets.map((issue) => (
                <div
                  key={issue.id}
                  className="py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-[#faf8ff] px-3 rounded-xl transition"
                >
                  {/* Left: Ticket Info */}
                  <div
                    className="flex-1 space-y-1 cursor-pointer"
                    onClick={() => onSelectIssue(issue)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-headline font-bold text-sm text-[#131b2e] hover:text-[#003bbe] transition">
                        {issue.title}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          issue.urgency === 'critical'
                            ? 'bg-[#ffdad6] text-[#93000a] border border-rose-300'
                            : issue.urgency === 'high'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-[#eaedff] text-[#00397f]'
                        }`}
                      >
                        {issue.urgency}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          issue.status === 'resolved'
                            ? 'bg-[#6ffbbe]/25 text-[#005539] border border-emerald-300'
                            : issue.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-800'
                            : issue.status === 'rejected'
                            ? 'bg-rose-100 text-[#ba1a1a]'
                            : 'bg-blue-100 text-[#003bbe]'
                        }`}
                      >
                        {issue.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-xs text-[#434656] flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#003bbe]">{issue.category}</span>
                      <span>·</span>
                      <span>{issue.location}</span>
                      <span>·</span>
                      <span className="text-slate-400">
                        Reported by {issue.creator_name || 'Member'} on{' '}
                        {new Date(issue.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Resolution details if resolved */}
                    {issue.status === 'resolved' && (
                      <div className="text-xs text-[#005539] flex items-center gap-1.5 pt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00704c]" />
                        <span>
                          Fixed by: <strong>{issue.worker_name || 'Staff'}{issue.worker_department ? `, ${issue.worker_department}` : ''}</strong>{' '}
                          on {new Date(issue.resolved_at || issue.updated_at).toLocaleDateString()}
                        </span>
                        {issue.resolution_notes && (
                          <span className="text-slate-500 truncate max-w-xs">
                            — "{issue.resolution_notes}"
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Worker assignment & Action controls */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-end">
                    {/* Worker Assigner Dropdown */}
                    <div className="flex items-center gap-1.5 bg-[#f2f3ff] rounded-full px-2.5 py-1 border border-[#dae2fd]">
                      <Wrench className="w-3 h-3 text-[#003bbe]" />
                      <select
                        value={issue.assigned_to || ''}
                        onChange={(e) => handleWorkerAssign(issue.id, e.target.value)}
                        className="bg-transparent text-xs text-[#131b2e] font-medium outline-none max-w-[150px] truncate cursor-pointer"
                        title="Assign worker"
                      >
                        <option value="">-- Unassigned --</option>
                        {availableWorkers.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} {w.department ? `(${w.department})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Resolve button */}
                    {issue.status !== 'resolved' && (
                      <button
                        onClick={() =>
                          setActionModal({
                            open: true,
                            type: 'resolve',
                            issue,
                            note: '',
                          })
                        }
                        className="px-3 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-[#005539] border border-emerald-200 text-xs font-bold cursor-pointer transition flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Resolve</span>
                      </button>
                    )}

                    {/* Reject button */}
                    {issue.status !== 'rejected' && issue.status !== 'resolved' && (
                      <button
                        onClick={() =>
                          setActionModal({
                            open: true,
                            type: 'reject',
                            issue,
                            note: '',
                          })
                        }
                        className="px-3 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-[#ba1a1a] border border-rose-200 text-xs font-bold cursor-pointer transition flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Reject</span>
                      </button>
                    )}

                    {/* Details button */}
                    <button
                      onClick={() => onSelectIssue(issue)}
                      className="px-3 py-1 rounded-full bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-xs font-medium cursor-pointer transition"
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MANAGE PEOPLE AND ROLES */}
      {activeTab === 'people' && (
        <div className="bg-white rounded-2xl border border-[#dae2fd] p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-headline font-bold text-lg text-[#131b2e] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#003bbe]" />
                <span>Campus People & Role Management</span>
              </h3>
              <p className="text-xs text-[#434656]">
                Manage residents, technicians, and operations admins for {campus.name}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search members..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-xs text-[#131b2e] outline-none focus:bg-white"
                />
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
              </div>

              {isAdmin && (
                <button
                  onClick={() => setShowAddStaffModal(true)}
                  className="px-3.5 py-1.5 rounded-full bg-[#003bbe] hover:bg-[#1150ef] text-white font-bold text-xs flex items-center gap-1 shadow-sm transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Staff</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#131b2e]">
              <thead className="bg-[#f2f3ff] text-[11px] font-bold text-[#434656] uppercase tracking-wider border-b border-[#dae2fd]">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Name & Email</th>
                  <th className="py-3 px-4">Department / Phone</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4">Role Management</th>
                  <th className="py-3 px-4 text-right rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2f3ff]">
                {members
                  .filter(
                    (m) =>
                      memberSearch.trim() === '' ||
                      m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                      m.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
                      (m.department && m.department.toLowerCase().includes(memberSearch.toLowerCase()))
                  )
                  .map((m) => {
                    const isSelf = m.id === currentUser.id;
                    const isTargetAdmin = m.role === 'admin';
                    const canChangeRole =
                      (isAdmin && !isTargetAdmin) || currentUser.role === 'founder' || (isAdmin && isSelf);

                    return (
                      <tr key={m.id} className="hover:bg-[#faf8ff] transition">
                        <td className="py-3.5 px-4 font-semibold text-[#131b2e]">
                          <div className="flex items-center gap-2">
                            <span>{m.name}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-[#dde1ff] text-[#001452] px-2 py-0.2 rounded-full font-bold">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#434656] font-mono font-normal">{m.email}</div>
                        </td>

                        <td className="py-3.5 px-4 text-[#434656]">
                          <div className="font-medium text-[#131b2e]">{m.department || 'General'}</div>
                          {m.phone && <div className="text-[10px] text-slate-400 font-mono">{m.phone}</div>}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              m.role === 'admin'
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                : m.role === 'co_admin'
                                ? 'bg-cyan-100 text-cyan-900 border border-cyan-200'
                                : m.role === 'worker'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-[#eaedff] text-[#00397f]'
                            }`}
                          >
                            {m.role.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {canChangeRole ? (
                            <select
                              value={m.role}
                              onChange={(e) => handleRoleChange(m.id, m.name, e.target.value)}
                              className="px-2.5 py-1 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-xs text-[#131b2e] outline-none font-medium cursor-pointer"
                            >
                              <option value="user">User (Member)</option>
                              <option value="worker">Worker (Field Staff)</option>
                              <option value="co_admin">Co-Admin (Operations)</option>
                              {currentUser.role === 'founder' && <option value="admin">Admin</option>}
                            </select>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Protected Role</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {isAdmin && !isSelf && !isTargetAdmin && ['worker', 'co_admin'].includes(m.role) && (
                            <button
                              onClick={() => handleRemoveStaff(m.id, m.name)}
                              className="p-1.5 rounded-full hover:bg-rose-100 text-[#ba1a1a] transition cursor-pointer"
                              title="Remove staff member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Dialog Modal: Resolve or Reject */}
      {actionModal.open && actionModal.issue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#dae2fd] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div
                className={`flex items-center gap-2 font-bold text-sm ${
                  actionModal.type === 'resolve' ? 'text-[#005539]' : 'text-[#ba1a1a]'
                }`}
              >
                {actionModal.type === 'resolve' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-[#00704c]" />
                    <span className="font-headline font-bold text-base">Mark Ticket as Resolved</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-[#ba1a1a]" />
                    <span className="font-headline font-bold text-base">Reject Ticket</span>
                  </>
                )}
              </div>
              <button
                onClick={() => setActionModal({ ...actionModal, open: false })}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f2f3ff] text-xs">
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Target Ticket:</span>
              <span className="font-bold text-[#131b2e] text-sm">{actionModal.issue.title}</span>
              <span className="text-slate-500 block mt-1">{actionModal.issue.location}</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#131b2e] mb-1.5">
                {actionModal.type === 'resolve' ? 'Resolution Notes (Optional):' : 'Rejection Reason:'}
              </label>
              <textarea
                rows={3}
                value={actionModal.note}
                onChange={(e) => setActionModal({ ...actionModal, note: e.target.value })}
                placeholder={
                  actionModal.type === 'resolve'
                    ? 'Explain the repairs carried out and verified...'
                    : 'Provide the reason why this issue cannot be processed...'
                }
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#c3c5d8] text-xs text-[#131b2e] outline-none focus:border-[#003bbe] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionModal({ ...actionModal, open: false })}
                className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleConfirmTicketAction}
                className={`px-5 py-2 rounded-full text-white text-xs font-bold shadow-md cursor-pointer transition ${
                  actionModal.type === 'resolve'
                    ? 'bg-[#00704c] hover:bg-[#005539]'
                    : 'bg-[#ba1a1a] hover:bg-[#93000a]'
                }`}
              >
                {submittingAction
                  ? 'Saving...'
                  : actionModal.type === 'resolve'
                  ? 'Confirm Resolution'
                  : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#dae2fd] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-headline font-bold text-base text-[#131b2e] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#003bbe]" />
                <span>Provision Campus Staff Account</span>
              </h3>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            {staffError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[#ba1a1a] text-xs">
                {staffError}
              </div>
            )}

            <form onSubmit={handleAddStaff} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#131b2e] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newStaffForm.name}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-[#131b2e] outline-none focus:bg-white focus:border-[#003bbe]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#131b2e] mb-1">Campus Staff Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ramesh.plumber@campus.edu"
                  value={newStaffForm.email}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-[#131b2e] outline-none focus:bg-white focus:border-[#003bbe]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#131b2e] mb-1">Password (min 6 characters) *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={newStaffForm.password}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-[#131b2e] outline-none focus:bg-white focus:border-[#003bbe]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#131b2e] mb-1">Role *</label>
                  <select
                    value={newStaffForm.role}
                    onChange={(e) =>
                      setNewStaffForm({
                        ...newStaffForm,
                        role: e.target.value as 'worker' | 'co_admin',
                      })
                    }
                    className="w-full px-3 py-2 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-[#131b2e] outline-none font-medium cursor-pointer"
                  >
                    <option value="worker">Field Worker</option>
                    <option value="co_admin">Co-Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#131b2e] mb-1">Job Title / Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Plumber, Electrician"
                    value={newStaffForm.department}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-[#131b2e] outline-none focus:bg-white focus:border-[#003bbe]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#131b2e] mb-1">Contact Phone (Optional)</label>
                <input
                  type="text"
                  placeholder="+1 555-0199"
                  value={newStaffForm.phone}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] text-[#131b2e] outline-none focus:bg-white focus:border-[#003bbe]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingStaff}
                  className="px-5 py-2 rounded-full bg-[#003bbe] hover:bg-[#1150ef] text-white font-bold shadow-md cursor-pointer transition disabled:opacity-50"
                >
                  {addingStaff ? 'Adding...' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
