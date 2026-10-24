import React, { useState } from 'react';
import {
  Building2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Users,
  AlertCircle,
  Database,
  Lock,
  Layers,
  ChevronRight,
  Cpu,
  MapPin,
  Check,
} from 'lucide-react';
import { Campus } from '../types';
import { registerAdminAndCampus } from '../api';

interface MainSiteLandingProps {
  campuses: Campus[];
  onCampusCreated: (campus: Campus) => void;
  onSelectCampus: (slug: string) => void;
  onOpenFounderLogin: () => void;
}

export const MainSiteLanding: React.FC<MainSiteLandingProps> = ({
  campuses,
  onCampusCreated,
  onSelectCampus,
  onOpenFounderLogin,
}) => {
  const [form, setForm] = useState({
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    campusName: '',
    campusSlug: '',
    campusType: 'university',
    city: '',
    campusDescription: '',
    campusAddress: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);
  const [localDevLink, setLocalDevLink] = useState<string | null>(null);

  const RESERVED_SLUGS = [
    'www',
    'api',
    'admin',
    'platform',
    'app',
    'c',
    'auth',
    'campuses',
    'campus',
    'dashboard',
    'settings',
    'founder',
    'help',
    'status',
  ];

  const handleSlugify = (name: string, city?: string) => {
    let slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (city && city.trim() !== '') {
      const cleanCity = city
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      if (cleanCity && !slug.includes(cleanCity)) {
        slug = `${slug}-${cleanCity}`;
      }
    }

    return slug;
  };

  const handleCampusNameChange = (val: string) => {
    setForm((prev) => {
      const autoSlug = handleSlugify(val, prev.city);
      const isAuto = prev.campusSlug === '' || prev.campusSlug === handleSlugify(prev.campusName, prev.city);
      return {
        ...prev,
        campusName: val,
        campusSlug: isAuto ? autoSlug : prev.campusSlug,
      };
    });
  };

  const handleCityChange = (val: string) => {
    setForm((prev) => {
      const autoSlug = handleSlugify(prev.campusName, val);
      const isAuto = prev.campusSlug === '' || prev.campusSlug === handleSlugify(prev.campusName, prev.city);
      return {
        ...prev,
        city: val,
        campusSlug: isAuto ? autoSlug : prev.campusSlug,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanSlug = form.campusSlug.toLowerCase().trim();
    if (RESERVED_SLUGS.includes(cleanSlug)) {
      setError(`"${cleanSlug}" is a reserved system name (reserved: www, api, admin, platform, etc.). Please choose another slug.`);
      return;
    }

    setLoading(true);

    try {
      const res = await registerAdminAndCampus(form);
      setSuccessLink(res.campusLink);
      setLocalDevLink(res.localLink || `/c/${form.campusSlug}`);
      onCampusCreated(res.campus);
    } catch (err: any) {
      setError(err.message || 'Failed to register campus and admin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Hero Band (Aether Civic Atmosphere) */}
      <section className="text-center max-w-3xl mx-auto pt-4 pb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold mb-4 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Decentralized Multi-Tenant Governance · Gemini AI Triage</span>
        </div>

        <h1 className="font-headline font-bold text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight">
          One unified platform for every campus grievance
        </h1>

        <p className="mt-4 text-sm sm:text-base text-white/90 max-w-2xl mx-auto leading-relaxed">
          Admins register on the main site to provision their isolated campus workspace with custom link{' '}
          <code className="text-[#001452] font-mono text-xs bg-white/80 px-2.5 py-0.5 rounded-full font-bold">
            &lt;campus&gt;.campusconnect.com
          </code>
          . Students endorse priorities, AI triages safety hazards, and field workers resolve issues with verified accountability.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#register-section"
            className="px-6 py-2.5 rounded-full bg-white text-[#003bbe] hover:bg-blue-50 font-bold text-xs sm:text-sm shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Register Campus Partition</span>
            <ArrowRight className="w-4 h-4 text-[#003bbe]" />
          </a>

          <button
            onClick={onOpenFounderLogin}
            className="px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/30 font-semibold text-xs sm:text-sm backdrop-blur-md transition cursor-pointer flex items-center gap-2"
          >
            <Lock className="w-4 h-4 text-[#6ffbbe]" />
            <span>Global Founder Portal</span>
          </button>
        </div>
      </section>

      {/* Main Operational Container (Level 2 Sheet Spec) */}
      <div id="register-section" className="w-full bg-white/95 backdrop-blur-xl rounded-2xl md:rounded-3xl shadow-[0_24px_48px_-12px_rgba(15,23,42,0.08),0_4px_12px_0_rgba(17,80,239,0.04)] border border-white/60 p-5 sm:p-8 md:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Admin Registration Form (7 cols) */}
          <div className="lg:col-span-7 bg-[#f2f3ff] border border-[#dae2fd] rounded-2xl p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-[#003bbe] text-white flex items-center justify-center shadow-md">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-headline font-bold text-xl text-[#131b2e]">
                  Register Admin & Provision Campus
                </h2>
                <p className="text-xs text-[#434656]">
                  Admins establish decentralized accountability with auto-routed grievance workflows.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[#ba1a1a] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#ba1a1a]" />
                <span>{error}</span>
              </div>
            )}

            {successLink && (
              <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#005539] text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-[#00704c]" />
                  <span>Campus Provisioned Successfully!</span>
                </div>
                <div className="space-y-1 text-slate-700 font-mono text-xs">
                  <p>
                    Production Subdomain Link:{' '}
                    <strong className="text-[#003bbe] underline">{successLink}</strong>
                  </p>
                  <p>
                    Local Development Path Link:{' '}
                    <strong className="text-[#003bbe] underline">{localDevLink || `/c/${form.campusSlug}`}</strong>
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onSelectCampus(form.campusSlug)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#00704c] hover:bg-[#005539] text-white font-bold cursor-pointer transition shadow-sm text-xs"
                  >
                    <span>Open Campus Portal ({localDevLink || `/c/${form.campusSlug}`})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {/* Section 1: Admin Account */}
              <div className="border-b border-[#dae2fd] pb-5">
                <span className="text-[11px] font-bold text-[#003bbe] uppercase tracking-wider block mb-3">
                  1. Lead Admin Credentials
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-[#131b2e] mb-1">
                      Admin Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Arthur Vance"
                      value={form.adminName}
                      onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-full bg-white border border-[#c3c5d8] text-[#131b2e] text-xs outline-none focus:border-[#003bbe]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#131b2e] mb-1">
                      Admin Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="admin@university.edu"
                      value={form.adminEmail}
                      onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-full bg-white border border-[#c3c5d8] text-[#131b2e] text-xs outline-none focus:border-[#003bbe]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#131b2e] mb-1">
                      Password * (scrypt hashed with salt)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Strong password (min 6 characters)"
                      value={form.adminPassword}
                      onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-full bg-white border border-[#c3c5d8] text-[#131b2e] text-xs outline-none focus:border-[#003bbe]"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Campus Details */}
              <div className="space-y-3.5">
                <span className="text-[11px] font-bold text-[#003bbe] uppercase tracking-wider block">
                  2. Campus Specification & Subdomain
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-[#131b2e] mb-1">
                      Campus Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Stanford University"
                      value={form.campusName}
                      onChange={(e) => handleCampusNameChange(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-full bg-white border border-[#c3c5d8] text-[#131b2e] text-xs outline-none focus:border-[#003bbe]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#131b2e] mb-1">
                      Campus Category *
                    </label>
                    <select
                      value={form.campusType}
                      onChange={(e) => setForm({ ...form, campusType: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-full bg-white border border-[#c3c5d8] text-[#131b2e] text-xs font-medium outline-none focus:border-[#003bbe] cursor-pointer"
                    >
                      <option value="university">University</option>
                      <option value="school">School</option>
                      <option value="hostel">Hostel</option>
                      <option value="pg">PG (Paying Guest)</option>
                      <option value="residential_society">Residential Society</option>
                      <option value="other">Other Campus</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#131b2e] mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. New Delhi or Boston"
                      value={form.city}
                      onChange={(e) => handleCityChange(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-full bg-white border border-[#c3c5d8] text-[#131b2e] text-xs outline-none focus:border-[#003bbe]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#131b2e] mb-1">
                      Subdomain / Slug *
                    </label>
                    <div className="flex rounded-full overflow-hidden border border-[#c3c5d8] bg-white focus-within:border-[#003bbe]">
                      <input
                        type="text"
                        required
                        placeholder="iitd"
                        value={form.campusSlug}
                        onChange={(e) => setForm({ ...form, campusSlug: handleSlugify(e.target.value) })}
                        className="flex-1 px-4 py-2 text-[#131b2e] text-xs font-mono outline-none"
                      />
                      <span className="px-3 py-2 bg-[#eaedff] text-slate-600 text-[11px] font-mono border-l border-[#c3c5d8] select-none">
                        .campusconnect.com
                      </span>
                    </div>
                  </div>

                  {RESERVED_SLUGS.includes(form.campusSlug.toLowerCase().trim()) && (
                    <div className="sm:col-span-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs">
                      ⚠️ Note: &quot;{form.campusSlug}&quot; is a reserved system name. Choose a different unique slug.
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#131b2e] mb-1">
                      Address / Description (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Hauz Khas, New Delhi 110016"
                      value={form.campusDescription}
                      onChange={(e) => setForm({ ...form, campusDescription: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-full bg-white border border-[#c3c5d8] text-[#131b2e] text-xs outline-none focus:border-[#003bbe]"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-[#003bbe] hover:bg-[#1150ef] disabled:opacity-50 text-white font-bold text-xs tracking-wide shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Provisioning Campus Partition...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    <span>Create Campus & Log In as Admin</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Directory of Active Campuses (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-headline font-bold text-lg text-[#131b2e] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#003bbe]" />
                  <span>Registered Campus Directory</span>
                </h3>
                <p className="text-xs text-[#434656]">Direct portal links for each campus</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#eaedff] text-[#00397f] text-[11px] font-mono font-bold">
                {campuses.length} active
              </span>
            </div>

            {campuses.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#f2f3ff] border border-dashed border-[#c3c5d8] text-center">
                <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-[#131b2e]">No campuses registered yet</h4>
                <p className="text-xs text-[#434656] mt-1 max-w-xs mx-auto">
                  Be the first admin to register a university, school, hostel, or residential society using the form.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {campuses.map((campus) => (
                  <div
                    key={campus.id}
                    onClick={() => onSelectCampus(campus.slug)}
                    className="p-4 rounded-2xl bg-[#f2f3ff] hover:bg-white border border-[#dae2fd] hover:border-[#003bbe]/40 transition-all shadow-xs hover:shadow-md cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate">
                        <h4 className="font-headline font-bold text-sm text-[#131b2e] group-hover:text-[#003bbe] transition truncate">
                          {campus.name}
                        </h4>
                        <div className="text-[11px] text-[#003bbe] font-mono font-medium truncate mt-0.5">
                          {campus.slug}.campusconnect.com
                        </div>
                        {campus.city && (
                          <div className="flex items-center gap-1 text-[11px] text-[#434656] mt-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{campus.city}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="px-2 py-0.5 rounded-full bg-white text-[#434656] text-[10px] font-bold uppercase tracking-wider capitalize border border-[#dae2fd]">
                          {campus.type.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-[#003bbe] font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition">
                          <span>Enter</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
