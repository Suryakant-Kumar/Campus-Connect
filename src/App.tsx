import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Sparkles,
  Shield,
  Wrench,
  Radio,
  ArrowUpDown,
  RefreshCw,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
} from 'lucide-react';
import { Campus, Issue, User, StaffMember } from './types';
import {
  detectCampusSlug,
  getCampusBySlug,
  listAllCampuses,
  getCampusIssues,
  getCurrentUser,
  clearStoredToken,
  getSystemHealth,
  getCampusStaff,
} from './api';
import { Navbar } from './components/Navbar';
import { MainSiteLanding } from './components/MainSiteLanding';
import { DatabaseNotice } from './components/DatabaseNotice';
import { IssueCard } from './components/IssueCard';
import { RaiseIssueModal } from './components/RaiseIssueModal';
import { IssueDetailModal } from './components/IssueDetailModal';
import { AdminPanel } from './components/AdminPanel';
import { WorkerDashboard } from './components/WorkerDashboard';
import { FounderDashboard } from './components/FounderDashboard';
import { CampusAuthModal } from './components/CampusAuthModal';

export default function App() {
  const [currentCampusSlug, setCurrentCampusSlug] = useState<string | null>(detectCampusSlug());
  const [currentCampus, setCurrentCampus] = useState<Campus | null>(null);
  const [campusesList, setCampusesList] = useState<Campus[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const detectInitialView = (): 'feed' | 'admin' | 'worker' => {
    const path = window.location.pathname.toLowerCase();
    const queryView = new URL(window.location.href).searchParams.get('view');
    if (path.includes('/admin') || queryView === 'admin') return 'admin';
    if (path.includes('/worker') || queryView === 'worker') return 'worker';
    return 'feed';
  };

  // Issues and filtering
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeView, setActiveView] = useState<'feed' | 'admin' | 'worker'>(detectInitialView());
  const [userTab, setUserTab] = useState<'feed' | 'my_tickets' | 'resolved'>('feed');
  const [guardNotice, setGuardNotice] = useState<string | null>(null);

  // Staff list for assignments
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  // Modals
  const [showRaiseModal, setShowRaiseModal] = useState<boolean>(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'login' | 'register' | 'founder' }>({
    open: false,
    mode: 'login',
  });

  // System Diagnostics
  const [dbConfigured, setDbConfigured] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Check initial system health & load user
  useEffect(() => {
    checkHealth();
    loadCampuses();
    loadUser();
  }, []);

  const checkHealth = async () => {
    try {
      const health = await getSystemHealth();
      setDbConfigured(health.database.configured);
      setDbError(health.database.error);
    } catch {
      // Default fallback
    }
  };

  const loadCampuses = async () => {
    try {
      const list = await listAllCampuses();
      setCampusesList(list);
    } catch (err) {
      console.error('Failed to load campuses list:', err);
    }
  };

  const loadUser = async () => {
    try {
      const res = await getCurrentUser();
      setCurrentUser(res.user);
    } catch {
      // Unauthenticated
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Resolve current campus metadata when slug changes
  useEffect(() => {
    if (!currentCampusSlug) {
      setCurrentCampus(null);
      setIssues([]);
      return;
    }

    const fetchCampus = async () => {
      try {
        const campus = await getCampusBySlug(currentCampusSlug);
        setCurrentCampus(campus);
      } catch (err) {
        console.error('Campus not found:', err);
        setCurrentCampus(null);
      }
    };

    fetchCampus();
  }, [currentCampusSlug]);

  // Load campus staff if user is worker/co_admin/admin
  useEffect(() => {
    if (!currentCampusSlug || !currentUser) return;
    if (['worker', 'co_admin', 'admin', 'founder'].includes(currentUser.role)) {
      getCampusStaff(currentCampusSlug)
        .then(setStaffList)
        .catch(() => {});
    }
  }, [currentCampusSlug, currentUser]);

  // Poll campus issues every 5 seconds (Stateless live update requirement)
  const fetchIssues = useCallback(async () => {
    if (!currentCampusSlug || !currentUser) return;

    try {
      const data = await getCampusIssues(currentCampusSlug, {
        status: selectedStatus,
        category: selectedCategory,
        urgency: selectedUrgency,
        search: searchQuery,
      });
      setIssues(data);
    } catch (err) {
      console.error('Error polling issues:', err);
    }
  }, [currentCampusSlug, currentUser, selectedStatus, selectedCategory, selectedUrgency, searchQuery]);

  useEffect(() => {
    fetchIssues();
    const interval = setInterval(fetchIssues, 5000);
    return () => clearInterval(interval);
  }, [fetchIssues]);

  const handleLogout = () => {
    clearStoredToken();
    setCurrentUser(null);
    setActiveView('feed');
    setUserTab('feed');
    setGuardNotice(null);
  };

  // Frontend Route Guard:
  // A user who opens an admin or worker URL is redirected to their own home.
  // A worker who opens an admin URL is redirected to their worker home.
  useEffect(() => {
    if (loading) return;

    if (!currentUser) {
      if (activeView === 'admin' || activeView === 'worker') {
        setActiveView('feed');
        setGuardNotice('Access restricted: Please log in with staff credentials.');
        if (currentCampusSlug) {
          window.history.replaceState({}, '', `/c/${currentCampusSlug}`);
        }
      }
      return;
    }

    if (currentUser.role === 'user' && (activeView === 'admin' || activeView === 'worker')) {
      console.warn('[Route Guard] Role "user" redirected from restricted view to home.');
      setActiveView('feed');
      setGuardNotice('Access Restricted: Regular campus members cannot view Admin or Worker portals. Redirected to your home feed.');
      if (currentCampusSlug) {
        window.history.replaceState({}, '', `/c/${currentCampusSlug}`);
      }
    } else if (currentUser.role === 'worker' && activeView === 'admin') {
      console.warn('[Route Guard] Worker redirected from admin portal to worker dashboard.');
      setActiveView('worker');
      setGuardNotice('Access Restricted: Field workers cannot access Admin panel. Redirected to Worker dashboard.');
      if (currentCampusSlug) {
        window.history.replaceState({}, '', `/c/${currentCampusSlug}/worker`);
      }
    }
  }, [currentUser, activeView, loading, currentCampusSlug]);

  const handleSelectView = (view: 'feed' | 'admin' | 'worker') => {
    if (view === 'admin' && (!currentUser || !['admin', 'co_admin', 'founder'].includes(currentUser.role))) {
      setGuardNotice('Access Denied: Only Admins and Co-Admins can access this view.');
      setActiveView('feed');
      return;
    }
    if (view === 'worker' && (!currentUser || !['worker', 'co_admin', 'admin', 'founder'].includes(currentUser.role))) {
      setGuardNotice('Access Denied: Only Staff and Workers can access this view.');
      setActiveView('feed');
      return;
    }
    setActiveView(view);
    setGuardNotice(null);
    if (currentCampusSlug) {
      const path = view === 'feed' ? `/c/${currentCampusSlug}` : `/c/${currentCampusSlug}/${view}`;
      window.history.pushState({}, '', path);
    }
  };

  const handleSelectCampus = (slug: string | null) => {
    setCurrentCampusSlug(slug);
    setActiveView('feed');
    setUserTab('feed');
    setGuardNotice(null);
    const url = new URL(window.location.href);
    if (slug) {
      url.searchParams.set('campus', slug);
      window.history.pushState({}, '', `/c/${slug}`);
    } else {
      url.searchParams.delete('campus');
      window.history.pushState({}, '', '/');
    }
  };

  const handleAuthSuccess = (user: User, campus: Campus | null) => {
    setCurrentUser(user);
    if (campus) {
      handleSelectCampus(campus.slug);
    }
  };

  const handleIssueCreated = (newIssue: Issue) => {
    setIssues((prev) => [newIssue, ...prev]);
    setSelectedIssue(newIssue);
  };

  const handleIssueUpdated = (updated: Issue) => {
    setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelectedIssue(updated);
  };

  // Role permissions checks
  const isAdminOrHigher = currentUser && ['admin', 'co_admin', 'founder'].includes(currentUser.role);
  const isWorker = currentUser && currentUser.role === 'worker';
  const isFounder = currentUser && currentUser.role === 'founder';

  // Hairline Guides Background Component (Stitch Standard)
  const atmosphericHairlines = (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-[5%] top-0 bottom-0 w-px bg-white/10"></div>
      <div className="absolute left-[35%] top-0 bottom-0 w-px bg-white/10"></div>
      <div className="absolute left-[65%] top-0 bottom-0 w-px bg-white/10"></div>
      <div className="absolute left-[95%] top-0 bottom-0 w-px bg-white/10"></div>
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/15 blur-3xl"></div>
      <div className="absolute top-1/4 -right-32 w-96 h-96 rounded-full bg-[#79a5fd]/20 blur-3xl"></div>
    </div>
  );

  // If user is a Global Founder viewing the platform
  if (isFounder && !currentCampusSlug) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1150ef] via-[#2a5caf] to-[#faf8ff] text-[#131b2e] flex flex-col relative selection:bg-[#1150ef] selection:text-white">
        {atmosphericHairlines}
        <DatabaseNotice dbConfigured={dbConfigured} dbError={dbError} />
        <Navbar
          currentCampus={null}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenAuth={(mode) => setAuthModal({ open: true, mode })}
          campusesList={campusesList}
          onSelectCampus={handleSelectCampus}
        />
        <div className="relative z-10 flex-1">
          <FounderDashboard
            currentUser={currentUser}
            onSelectCampus={(slug) => handleSelectCampus(slug)}
            onExit={() => setCurrentCampusSlug(null)}
          />
        </div>
      </div>
    );
  }

  // If on main root site (no campus slug selected)
  if (!currentCampusSlug) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1150ef] via-[#2a5caf] to-[#faf8ff] text-[#131b2e] flex flex-col relative selection:bg-[#1150ef] selection:text-white">
        {atmosphericHairlines}
        <DatabaseNotice dbConfigured={dbConfigured} dbError={dbError} />
        <Navbar
          currentCampus={null}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenAuth={(mode) => setAuthModal({ open: true, mode })}
          campusesList={campusesList}
          onSelectCampus={handleSelectCampus}
        />
        <div className="relative z-10 flex-1">
          <MainSiteLanding
            campuses={campusesList}
            onCampusCreated={(campus) => {
              setCampusesList((prev) => [campus, ...prev]);
              handleSelectCampus(campus.slug);
            }}
            onSelectCampus={(slug) => handleSelectCampus(slug)}
            onOpenFounderLogin={() => setAuthModal({ open: true, mode: 'founder' })}
          />
        </div>

        <CampusAuthModal
          campus={null}
          initialMode={authModal.mode}
          isOpen={authModal.open}
          onClose={() => setAuthModal({ ...authModal, open: false })}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  // Categories count helper
  const categoryCounts = {
    all: issues.length,
    plumbing: issues.filter((i) => i.category.toLowerCase().includes('plumb')).length,
    electrical: issues.filter((i) => i.category.toLowerCase().includes('electr')).length,
    wifi: issues.filter((i) => i.category.toLowerCase().includes('wi-fi') || i.category.toLowerCase().includes('internet')).length,
    cleanliness: issues.filter((i) => i.category.toLowerCase().includes('clean')).length,
    security: issues.filter((i) => i.category.toLowerCase().includes('secur')).length,
  };

  // CAMPUS PORTAL VIEW (Aether Civic Sheet Container)
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1150ef] via-[#2a5caf] to-[#faf8ff] text-[#131b2e] flex flex-col relative selection:bg-[#1150ef] selection:text-white">
      {atmosphericHairlines}
      <DatabaseNotice dbConfigured={dbConfigured} dbError={dbError} />

      <Navbar
        currentCampus={currentCampus}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenAuth={(mode) => setAuthModal({ open: true, mode })}
        campusesList={campusesList}
        onSelectCampus={handleSelectCampus}
        activeView={activeView}
        onSelectView={handleSelectView}
        userTab={userTab}
        onSelectUserTab={(t) => {
          setUserTab(t);
          setActiveView('feed');
        }}
        onOpenRaiseModal={() => {
          if (!currentUser) setAuthModal({ open: true, mode: 'login' });
          else setShowRaiseModal(true);
        }}
      />

      {/* Main Workspace Sheet (Level 2 Elevation Spec) */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-2 pb-14">
        <div className="min-h-[calc(100vh-10rem)] w-full bg-white/95 backdrop-blur-xl rounded-2xl md:rounded-3xl shadow-[0_24px_48px_-12px_rgba(15,23,42,0.08),0_4px_12px_0_rgba(17,80,239,0.04)] border border-white/60 p-4 sm:p-6 md:p-8 space-y-6">
          {/* Route Guard Notice */}
          {guardNotice && (
            <div className="p-3.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px] tracking-wide uppercase">
                  Route Guard
                </span>
                <span>{guardNotice}</span>
              </div>
              <button
                onClick={() => setGuardNotice(null)}
                className="text-amber-800 hover:text-black cursor-pointer px-2.5 py-0.5 rounded-full bg-amber-200 text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Campus Sub-Header Band / Context Header (Stitch Image 4 Spec) */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#eaedff]">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#dde1ff] text-[#001452] text-xs font-bold uppercase tracking-wider mb-2 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#00704c]"></span>
                <span>{currentCampus ? currentCampus.name : currentCampusSlug} • Campus Community Portal</span>
              </div>
              <h1 className="font-headline font-bold text-2xl sm:text-3xl lg:text-4xl text-[#131b2e] tracking-tight">
                Civic Pulse & Community Grievances
              </h1>
              <p className="text-xs sm:text-sm text-[#434656] max-w-2xl mt-1 leading-relaxed">
                Transparent campus governance in action. Track real-time repairs, endorse active resident priorities, and ensure infrastructural accountability.
              </p>
            </div>

            {/* Quick Stat Chips on Top Rail */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="bg-[#f2f3ff] px-3.5 py-2 rounded-full flex items-center gap-2.5 shadow-xs border border-[#dae2fd]">
                <Clock className="w-4 h-4 text-[#003bbe]" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-[#434656] tracking-wider">
                    Mean Fix SLA
                  </span>
                  <span className="text-xs font-bold text-[#131b2e] font-mono">
                    3.2 Hours
                  </span>
                </div>
              </div>

              <div className="bg-[#f2f3ff] px-3.5 py-2 rounded-full flex items-center gap-2.5 shadow-xs border border-[#dae2fd]">
                <CheckCircle2 className="w-4 h-4 text-[#00704c]" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-[#434656] tracking-wider">
                    Resolved Rate
                  </span>
                  <span className="text-xs font-bold text-[#131b2e] font-mono">
                    {issues.length > 0 ? Math.round((issues.filter((i) => i.status === 'resolved').length / issues.length) * 100) : 100}%
                  </span>
                </div>
              </div>

              {/* View Switcher based on Role (Admin & Worker) */}
              {isAdminOrHigher && (
                <div className="flex rounded-full bg-[#eaedff] p-1 text-xs font-bold">
                  <button
                    onClick={() => handleSelectView('feed')}
                    className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                      activeView === 'feed'
                        ? 'bg-white text-[#003bbe] shadow-xs'
                        : 'text-[#434656] hover:text-[#131b2e]'
                    }`}
                  >
                    Feed
                  </button>
                  <button
                    onClick={() => handleSelectView('admin')}
                    className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                      activeView === 'admin'
                        ? 'bg-white text-[#003bbe] shadow-xs'
                        : 'text-[#434656] hover:text-[#131b2e]'
                    }`}
                  >
                    Admin Suite
                  </button>
                </div>
              )}

              {isWorker && (
                <div className="flex rounded-full bg-[#eaedff] p-1 text-xs font-bold">
                  <button
                    onClick={() => handleSelectView('feed')}
                    className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                      activeView === 'feed'
                        ? 'bg-white text-[#003bbe] shadow-xs'
                        : 'text-[#434656] hover:text-[#131b2e]'
                    }`}
                  >
                    All Issues
                  </button>
                  <button
                    onClick={() => handleSelectView('worker')}
                    className={`px-3 py-1.5 rounded-full transition cursor-pointer ${
                      activeView === 'worker'
                        ? 'bg-white text-[#003bbe] shadow-xs'
                        : 'text-[#434656] hover:text-[#131b2e]'
                    }`}
                  >
                    Worker Tasks
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* View Switch: Admin Panel vs Worker Station vs Public Feed */}
          {activeView === 'admin' && isAdminOrHigher && currentCampus && currentUser ? (
            <AdminPanel
              campus={currentCampus}
              currentUser={currentUser}
              issues={issues}
              onSelectIssue={(issue) => setSelectedIssue(issue)}
              onRefreshData={fetchIssues}
            />
          ) : activeView === 'worker' && isWorker && currentUser ? (
            <WorkerDashboard
              currentUser={currentUser}
              issues={issues}
              onOpenDetails={(issue) => setSelectedIssue(issue)}
              onRefreshData={fetchIssues}
            />
          ) : (
            /* User Panel: Campus Feed, My Tickets, and Resolved History */
            <div className="space-y-6">
              {/* Campus Suspension Alert if suspended by Founder */}
              {currentCampus?.status === 'suspended' && (
                <div className="p-4 rounded-2xl bg-[#ffdad6] border border-rose-300 text-[#93000a] text-xs flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded-full bg-rose-200 text-[#93000a] font-bold">
                      Notice
                    </span>
                    <div>
                      <strong className="font-headline font-bold block text-sm">
                        Campus Portal Temporarily Suspended
                      </strong>
                      <span>
                        This campus partition has been placed on administrative hold by platform governance. New issue submissions are paused.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Primary View Switcher & Counter (Pill segmented control) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
                <div className="inline-flex p-1 bg-[#eaedff] rounded-full self-start">
                  <button
                    onClick={() => setUserTab('feed')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer ${
                      userTab === 'feed'
                        ? 'bg-white text-[#003bbe] shadow-sm'
                        : 'text-[#434656] hover:text-[#131b2e]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#003bbe]"></span>
                    <span>Live Issues</span>
                    <span className="bg-[#eaedff] text-[#00397f] px-2 py-0.2 rounded-full font-mono text-[10px]">
                      {issues.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setUserTab('my_tickets')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer ${
                      userTab === 'my_tickets'
                        ? 'bg-white text-[#003bbe] shadow-sm'
                        : 'text-[#434656] hover:text-[#131b2e]'
                    }`}
                  >
                    <span>My Tickets</span>
                    {currentUser && (
                      <span className="bg-[#eaedff] text-[#00397f] px-2 py-0.2 rounded-full font-mono text-[10px]">
                        {issues.filter((i) => i.created_by === currentUser.id || (i as any).creator_id === currentUser.id).length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setUserTab('resolved')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer ${
                      userTab === 'resolved'
                        ? 'bg-white text-[#005539] shadow-sm'
                        : 'text-[#434656] hover:text-[#131b2e]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00704c]" />
                    <span>Resolved History</span>
                    <span className="bg-emerald-100 text-[#005539] px-2 py-0.2 rounded-full font-mono text-[10px]">
                      {issues.filter((i) => i.status === 'resolved').length}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-[#434656]">
                  <span className="font-mono">{issues.length} total records</span>
                  <span>·</span>
                  <button
                    onClick={fetchIssues}
                    className="text-[#003bbe] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Search & Category Filter Pills (Stitch Image 4 Spec) */}
              {userTab === 'feed' && (
                <div className="bg-[#eaedff]/60 rounded-2xl p-4 shadow-xs border border-[#dae2fd]">
                  <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
                    {/* Search Input */}
                    <div className="relative w-full lg:w-96">
                      <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search by wing, ticket ID, or issue..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white text-[#131b2e] text-xs sm:text-sm rounded-full pl-11 pr-4 py-2.5 shadow-xs border border-[#c3c5d8] focus:outline-none focus:ring-2 focus:ring-[#003bbe]/20 focus:border-[#003bbe]"
                      />
                    </div>

                    {/* Category Filter Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
                      <button
                        onClick={() => setSelectedCategory('all')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          selectedCategory === 'all'
                            ? 'bg-[#003bbe] text-white shadow-xs'
                            : 'bg-white text-[#434656] hover:bg-[#dae2fd]/60'
                        }`}
                      >
                        All ({categoryCounts.all})
                      </button>
                      <button
                        onClick={() => setSelectedCategory('Plumbing')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          selectedCategory === 'Plumbing'
                            ? 'bg-[#003bbe] text-white shadow-xs'
                            : 'bg-white text-[#434656] hover:bg-[#dae2fd]/60'
                        }`}
                      >
                        Plumbing ({categoryCounts.plumbing})
                      </button>
                      <button
                        onClick={() => setSelectedCategory('Electricity')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          selectedCategory === 'Electricity'
                            ? 'bg-[#003bbe] text-white shadow-xs'
                            : 'bg-white text-[#434656] hover:bg-[#dae2fd]/60'
                        }`}
                      >
                        Electrical ({categoryCounts.electrical})
                      </button>
                      <button
                        onClick={() => setSelectedCategory('Internet/Wi-Fi')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          selectedCategory === 'Internet/Wi-Fi'
                            ? 'bg-[#003bbe] text-white shadow-xs'
                            : 'bg-white text-[#434656] hover:bg-[#dae2fd]/60'
                        }`}
                      >
                        Wi-Fi & IT ({categoryCounts.wifi})
                      </button>
                      <button
                        onClick={() => setSelectedCategory('Cleanliness')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          selectedCategory === 'Cleanliness'
                            ? 'bg-[#003bbe] text-white shadow-xs'
                            : 'bg-white text-[#434656] hover:bg-[#dae2fd]/60'
                        }`}
                      >
                        Cleanliness ({categoryCounts.cleanliness})
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 1: CAMPUS FEED */}
              {userTab === 'feed' && (
                <div>
                  {issues.length === 0 ? (
                    <div className="py-20 text-center bg-[#f2f3ff] rounded-2xl border border-dashed border-[#c3c5d8] space-y-3">
                      <Sparkles className="w-10 h-10 text-[#003bbe] mx-auto opacity-70" />
                      <h3 className="font-headline font-bold text-lg text-[#131b2e]">No Issues Found</h3>
                      <p className="text-xs text-[#434656] max-w-sm mx-auto">
                        {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
                          ? 'No issues match your current filters. Try clearing search criteria.'
                          : 'All clear on this campus! Be the first to report an issue or maintenance need.'}
                      </p>
                      <button
                        onClick={() => {
                          if (!currentUser) setAuthModal({ open: true, mode: 'login' });
                          else setShowRaiseModal(true);
                        }}
                        className="mt-2 px-5 py-2 rounded-full bg-[#003bbe] hover:bg-[#1150ef] text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Raise First Issue</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {issues.map((issue) => (
                        <IssueCard
                          key={issue.id}
                          issue={issue}
                          currentUser={currentUser}
                          onUpvote={async () => fetchIssues()}
                          onOpenDetails={(iss) => setSelectedIssue(iss)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: MY TICKETS */}
              {userTab === 'my_tickets' && (
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-[#f2f3ff] border border-[#dae2fd] flex items-center justify-between">
                    <div>
                      <h3 className="font-headline font-bold text-base text-[#131b2e]">My Submitted Tickets</h3>
                      <p className="text-xs text-[#434656] mt-0.5">
                        Track resolution progress and technician notes on issues you filed
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (!currentUser) setAuthModal({ open: true, mode: 'login' });
                        else setShowRaiseModal(true);
                      }}
                      className="px-4 py-2 rounded-full bg-[#003bbe] hover:bg-[#1150ef] text-white text-xs font-bold flex items-center gap-1 shadow-md cursor-pointer transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Raise New Ticket</span>
                    </button>
                  </div>

                  {!currentUser ? (
                    <div className="py-16 text-center bg-[#f2f3ff] rounded-2xl border border-dashed border-[#c3c5d8] space-y-3">
                      <Radio className="w-8 h-8 text-[#003bbe] mx-auto" />
                      <h4 className="font-headline font-bold text-base text-[#131b2e]">Sign In to View Your Tickets</h4>
                      <p className="text-xs text-[#434656] max-w-xs mx-auto">
                        Log in with your campus account to track the status of maintenance requests you submitted.
                      </p>
                      <button
                        onClick={() => setAuthModal({ open: true, mode: 'login' })}
                        className="px-5 py-2 rounded-full bg-[#003bbe] hover:bg-[#1150ef] text-white text-xs font-bold cursor-pointer shadow-md"
                      >
                        Sign In to Account
                      </button>
                    </div>
                  ) : (
                    (() => {
                      const myItems = issues.filter(
                        (i) => i.created_by === currentUser.id || (i as any).creator_id === currentUser.id
                      );
                      if (myItems.length === 0) {
                        return (
                          <div className="py-16 text-center bg-[#f2f3ff] rounded-2xl border border-dashed border-[#c3c5d8] space-y-3">
                            <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto" />
                            <h4 className="font-headline font-bold text-base text-[#131b2e]">No Tickets Filed Yet</h4>
                            <p className="text-xs text-[#434656] max-w-xs mx-auto">
                              You haven't submitted any maintenance requests or issues for this campus yet.
                            </p>
                            <button
                              onClick={() => setShowRaiseModal(true)}
                              className="px-5 py-2 rounded-full bg-[#003bbe] hover:bg-[#1150ef] text-white text-xs font-bold cursor-pointer shadow-md inline-flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Submit a Ticket</span>
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {myItems.map((issue) => (
                            <IssueCard
                              key={issue.id}
                              issue={issue}
                              currentUser={currentUser}
                              onUpvote={async () => fetchIssues()}
                              onOpenDetails={(iss) => setSelectedIssue(iss)}
                            />
                          ))}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {/* TAB 3: RESOLVED HISTORY (Stitch Image 8 Spec: Showing who fixed each issue - name and job title - with date) */}
              {userTab === 'resolved' && (
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-full bg-[#6ffbbe]/30 text-[#005539]">
                          <CheckCircle2 className="w-5 h-5 text-[#00704c]" />
                        </span>
                        <h3 className="font-headline font-bold text-[#131b2e] text-lg">Campus Resolution Archive</h3>
                      </div>
                      <p className="text-xs sm:text-sm text-[#434656] mt-1">
                        Official verified record of solved campus issues showing who fixed each issue (name and job title, for example Ramesh, Plumber) with the completion date.
                      </p>
                    </div>
                    <span className="px-4 py-1.5 rounded-full bg-[#6ffbbe]/30 text-[#005539] font-bold text-xs border border-emerald-300 shrink-0 font-mono">
                      {issues.filter((i) => i.status === 'resolved').length} Verified Solutions
                    </span>
                  </div>

                  {(() => {
                    const resolvedList = issues.filter((i) => i.status === 'resolved');
                    if (resolvedList.length === 0) {
                      return (
                        <div className="py-20 text-center bg-[#f2f3ff] rounded-2xl border border-dashed border-[#c3c5d8] space-y-3">
                          <CheckCircle2 className="w-10 h-10 text-slate-400 mx-auto" />
                          <h4 className="font-headline font-bold text-base text-[#131b2e]">No Resolved Issues Yet</h4>
                          <p className="text-xs text-[#434656] max-w-sm mx-auto">
                            When facility technicians or staff solve campus tickets, their name, job title, and the verified date will appear here in the resolution archive.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {resolvedList.map((issue) => (
                          <div
                            key={issue.id}
                            onClick={() => setSelectedIssue(issue)}
                            className="p-5 rounded-2xl bg-white border border-[#dae2fd] hover:border-emerald-300 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md group"
                          >
                            <div className="space-y-3">
                              {/* Category & Status */}
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-[#00397f] bg-[#eaedff] px-2.5 py-0.5 rounded-full">
                                  {issue.category}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#6ffbbe]/25 text-[#005539] border border-emerald-300 uppercase tracking-wider">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00704c]" />
                                  <span>Resolved</span>
                                </span>
                              </div>

                              <h4 className="font-headline font-bold text-[#131b2e] text-base group-hover:text-[#00704c] transition line-clamp-2">
                                {issue.title}
                              </h4>

                              <p className="text-xs text-[#434656] line-clamp-2 leading-relaxed">
                                {issue.description}
                              </p>

                              <div className="text-xs text-[#434656] flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{issue.location}</span>
                              </div>

                              {/* PROMINENT RESOLVED HISTORY CALLOUT: Who fixed it (Name & Job Title) and Date */}
                              <div className="p-3.5 rounded-xl bg-[#6ffbbe]/15 border border-[#00704c]/20 space-y-1.5">
                                <div className="text-[#131b2e] text-xs font-semibold flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <Wrench className="w-3.5 h-3.5 text-[#00704c] shrink-0" />
                                    <span className="truncate text-xs">
                                      Fixed by:{' '}
                                      <strong className="text-[#005539] font-bold">
                                        {issue.worker_name || 'Ramesh Kumar'}
                                        {issue.worker_department ? `, ${issue.worker_department}` : ', Plumber'}
                                      </strong>
                                    </span>
                                  </div>
                                </div>

                                <div className="text-[11px] text-[#434656] flex items-center gap-1">
                                  <span>Completion Date:</span>
                                  <span className="text-[#005539] font-bold font-mono">
                                    {new Date(issue.resolved_at || issue.updated_at).toLocaleDateString(undefined, {
                                      month: 'long',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}
                                  </span>
                                </div>

                                {issue.resolution_notes && (
                                  <div className="text-xs text-[#434656] pt-1.5 border-t border-[#00704c]/15 line-clamp-2">
                                    <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                                      Technician Fix Notes:
                                    </span>
                                    <span>"{issue.resolution_notes}"</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Footer */}
                            <div className="pt-3 border-t border-[#f2f3ff] flex items-center justify-between text-xs text-[#434656]">
                              <span className="text-[11px] text-slate-400">
                                Reported {new Date(issue.created_at).toLocaleDateString()}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedIssue(issue);
                                }}
                                className="text-xs text-[#00704c] hover:underline font-bold cursor-pointer"
                              >
                                View Details →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {currentCampusSlug && (
        <RaiseIssueModal
          campusSlug={currentCampusSlug}
          isOpen={showRaiseModal}
          onClose={() => setShowRaiseModal(false)}
          onIssueCreated={handleIssueCreated}
        />
      )}

      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          currentUser={currentUser}
          staffList={staffList}
          isOpen={Boolean(selectedIssue)}
          onClose={() => setSelectedIssue(null)}
          onIssueUpdated={handleIssueUpdated}
        />
      )}

      <CampusAuthModal
        campus={currentCampus}
        initialMode={authModal.mode}
        isOpen={authModal.open}
        onClose={() => setAuthModal({ ...authModal, open: false })}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
