import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Database,
  BarChart2,
  ExternalLink,
  Ban,
  Check,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { FounderAnalytics, User } from '../types';
import { getFounderCampuses, getFounderAnalytics, updateCampusStatus } from '../api';

interface FounderDashboardProps {
  currentUser: User;
  onSelectCampus: (slug: string) => void;
  onExit: () => void;
}

export const FounderDashboard: React.FC<FounderDashboardProps> = ({
  currentUser,
  onSelectCampus,
  onExit,
}) => {
  const [campuses, setCampuses] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<FounderAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadFounderData();
  }, []);

  const loadFounderData = async () => {
    setLoading(true);
    try {
      const [campusesData, statsData] = await Promise.all([
        getFounderCampuses(),
        getFounderAnalytics(),
      ]);
      setCampuses(campusesData);
      setAnalytics(statsData);
    } catch (err) {
      console.error('Failed to load founder dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (campus: any) => {
    const isSuspended = campus.status === 'suspended';
    const nextStatus = isSuspended ? 'active' : 'suspended';

    const confirmMsg = isSuspended
      ? `Reactivate campus "${campus.name}"? Members will be able to file and manage issues again.`
      : `Suspend campus "${campus.name}"? This will place the campus portal on administrative hold.`;

    if (!confirm(confirmMsg)) return;

    setActionLoadingId(campus.id);
    try {
      await updateCampusStatus(campus.id, nextStatus);
      setCampuses((prev) =>
        prev.map((c) => (c.id === campus.id ? { ...c, status: nextStatus } : c))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update campus status');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Ambient Telemetry Pill Bar (Stitch Image 16 Spec) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f2f3ff] text-[#2a5caf] text-xs font-bold border border-[#dae2fd]">
          <span className="w-2 h-2 rounded-full bg-[#00704c] animate-pulse"></span>
          <span className="uppercase tracking-wider">Multi-Tenant Governance Engine · AWS Asia-South</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#434656]">
          <span>Authenticated:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-[#dde1ff] text-[#001452] font-mono font-bold">
            Founder: {currentUser.email}
          </span>
        </div>
      </div>

      {/* High-End Scale Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#f2f3ff] via-white to-[#f2f3ff] p-6 md:p-8 border border-[#dae2fd] shadow-sm">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dde1ff] text-[#001452] text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-[#003bbe]" />
              <span>Multi-Tenant Network Telemetry</span>
            </div>
            <h1 className="font-headline font-bold text-2xl sm:text-3xl text-[#131b2e] tracking-tight">
              CampusConnect Founder & Super-Admin Console
            </h1>
            <p className="text-sm text-[#434656] mt-2">
              Global multi-tenant network telemetry across institutional partitions. Real-time observability, domain provisioning status, and campus administrative health.
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadFounderData}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-slate-50 text-[#131b2e] border border-[#c3c5d8] text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#003bbe]" />
              <span>Refresh Stats</span>
            </button>
            <button
              onClick={onExit}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#003bbe] hover:bg-[#1150ef] text-white text-xs font-bold shadow-md transition cursor-pointer"
            >
              <span>Exit to Main Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Global Metrics Bar (Bento Strip) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl bg-white border border-[#dae2fd] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#434656] mb-2">
            <span>Total Campuses</span>
            <Building2 className="w-4 h-4 text-[#003bbe]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline font-bold text-3xl text-[#131b2e] tabular-nums">
              {analytics?.totalCampuses ?? campuses.length}
            </span>
            <span className="text-xs font-bold text-[#005539] bg-[#6ffbbe]/30 px-2 py-0.5 rounded-full">
              {campuses.filter((c) => c.status !== 'suspended').length} active
            </span>
          </div>
          <div className="mt-2 text-xs text-[#434656]">
            {campuses.filter((c) => c.status === 'suspended').length} suspended on platform
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl bg-white border border-[#dae2fd] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#434656] mb-2">
            <span>Total Users</span>
            <Users className="w-4 h-4 text-[#2a5caf]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline font-bold text-3xl text-[#131b2e] tabular-nums">
              {analytics?.totalUsers ?? 0}
            </span>
            <span className="text-xs text-[#434656]">across partitions</span>
          </div>
          <div className="mt-2 text-xs text-[#434656]">
            Residents, workers, & administrators
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl bg-white border border-[#dae2fd] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#434656] mb-2">
            <span>Total Reported Issues</span>
            <BarChart2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline font-bold text-3xl text-[#131b2e] tabular-nums">
              {analytics?.totalIssues ?? 0}
            </span>
            <span className="text-xs text-[#434656]">aggregate</span>
          </div>
          <div className="mt-2 text-xs text-[#434656]">
            Platform-wide student & resident tickets
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl bg-white border border-[#dae2fd] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#434656] mb-2">
            <span>Resolved Tickets</span>
            <CheckCircle2 className="w-4 h-4 text-[#00704c]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline font-bold text-3xl text-[#131b2e] tabular-nums">
              {analytics?.resolvedIssues ?? 0}
            </span>
            <span className="text-xs font-bold text-[#005539] bg-[#6ffbbe]/30 px-2 py-0.5 rounded-full">
              {analytics?.totalIssues ? Math.round((analytics.resolvedIssues / analytics.totalIssues) * 100) : 100}%
            </span>
          </div>
          <div className="mt-2 text-xs text-[#434656]">
            Verified completed infrastructure repairs
          </div>
        </div>
      </div>

      {/* Campuses Table with Status & Counts & Suspend / Reactivate */}
      <div className="bg-white rounded-2xl border border-[#dae2fd] p-5 md:p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-headline font-bold text-lg text-[#131b2e] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#003bbe]" />
            <span>Campus Network Directory & Governance</span>
          </h2>
          <p className="text-xs text-[#434656]">
            Founder governance view: review institutional statistics, suspend or reactivate individual campus partitions
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#131b2e]">
            <thead className="bg-[#f2f3ff] text-[11px] font-bold text-[#434656] uppercase tracking-wider border-b border-[#dae2fd]">
              <tr>
                <th className="py-3 px-4 rounded-l-xl">Campus Name</th>
                <th className="py-3 px-4">Subdomain</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Members</th>
                <th className="py-3 px-4 text-center">Workers</th>
                <th className="py-3 px-4 text-center">Total Tickets</th>
                <th className="py-3 px-4 text-center">Open</th>
                <th className="py-3 px-4 text-center">Resolved</th>
                <th className="py-3 px-4 text-right rounded-r-xl">Governance Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f3ff]">
              {campuses.map((c) => {
                const isSuspended = c.status === 'suspended';
                const totalIssues = Number(c.total_issues || c.total_issues_count || 0);
                const resolvedIssues = Number(c.resolved_issues || c.resolved_issues_count || 0);
                const openIssues = totalIssues - resolvedIssues;

                return (
                  <tr key={c.id} className="hover:bg-[#faf8ff] transition">
                    <td className="py-3.5 px-4 font-semibold text-[#131b2e]">
                      <div>{c.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{c.contact_email}</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[#003bbe]">
                      {c.slug}.campusconnect.com
                    </td>

                    <td className="py-3.5 px-4">
                      {isSuspended ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ffdad6] text-[#93000a] border border-rose-300 uppercase tracking-wider">
                          <Ban className="w-3 h-3" />
                          <span>Suspended</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#6ffbbe]/25 text-[#005539] border border-emerald-300 uppercase tracking-wider">
                          <Check className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center font-semibold text-[#131b2e] tabular-nums">
                      {c.total_users || c.member_count || 1}
                    </td>

                    <td className="py-3.5 px-4 text-center text-[#434656] tabular-nums">
                      {c.worker_count || 0}
                    </td>

                    <td className="py-3.5 px-4 text-center font-semibold text-[#131b2e] tabular-nums">
                      {totalIssues}
                    </td>

                    <td className="py-3.5 px-4 text-center text-[#003bbe] font-bold tabular-nums">
                      {openIssues >= 0 ? openIssues : 0}
                    </td>

                    <td className="py-3.5 px-4 text-center text-[#005539] font-bold tabular-nums">
                      {resolvedIssues}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isSuspended ? (
                          <button
                            disabled={actionLoadingId === c.id}
                            onClick={() => handleToggleStatus(c)}
                            className="px-3 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-[#005539] border border-emerald-300 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Reactivate</span>
                          </button>
                        ) : (
                          <button
                            disabled={actionLoadingId === c.id}
                            onClick={() => handleToggleStatus(c)}
                            className="px-3 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-[#ba1a1a] border border-rose-200 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Suspend</span>
                          </button>
                        )}

                        <button
                          onClick={() => onSelectCampus(c.slug)}
                          className="px-3 py-1 rounded-full bg-[#f2f3ff] hover:bg-[#eaedff] text-[#003bbe] font-bold text-xs transition cursor-pointer"
                        >
                          View Feed
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
