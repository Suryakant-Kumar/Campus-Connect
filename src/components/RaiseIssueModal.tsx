import React, { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  Camera,
  MapPin,
  Upload,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Cpu,
} from 'lucide-react';
import { createIssue, uploadPhotoOnline } from '../api';
import { Issue } from '../types';

interface RaiseIssueModalProps {
  campusSlug: string;
  isOpen: boolean;
  onClose: () => void;
  onIssueCreated: (newIssue: Issue) => void;
}

const CATEGORIES = [
  'Electricity',
  'Plumbing',
  'Cleanliness',
  'Internet/Wi-Fi',
  'Security',
  'Furniture/Carpentry',
  'HVAC & Air Conditioning',
  'Noise Complaint',
  'Structural Damage',
  'General Maintenance',
];

export const RaiseIssueModal: React.FC<RaiseIssueModalProps> = ({
  campusSlug,
  isOpen,
  onClose,
  onIssueCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [location, setLocation] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Photo size exceeds 10MB limit.');
      return;
    }

    setUploadingPhoto(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const res = await uploadPhotoOnline(base64, file.name);
          setPhotoUrl(res.url);
        } catch (err: any) {
          setError(err.message || 'Photo upload failed.');
        } finally {
          setUploadingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingPhoto(false);
      setError('Failed to process image.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !location.trim()) {
      setError('Title, description, and specific location are required.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await createIssue(campusSlug, {
        title: title.trim(),
        description: description.trim(),
        category,
        location: location.trim(),
        photoUrl,
      });

      onIssueCreated(res.issue);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit issue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#dae2fd] rounded-2xl md:rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-8 text-[#131b2e]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#eaedff] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#003bbe] text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-[#131b2e]">Raise Campus Issue</h2>
              <p className="text-xs text-[#434656]">
                Gemini AI will inspect clarity, check safety, and assign priority.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[#ba1a1a] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#ba1a1a] shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#131b2e] mb-1">Issue Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Water leak in 3rd floor washroom"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] focus:bg-white focus:border-[#003bbe] text-[#131b2e] text-xs outline-none transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#131b2e] mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] focus:bg-white focus:border-[#003bbe] text-[#131b2e] text-xs font-medium outline-none transition cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#131b2e] mb-1">
                Specific Location / Room *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Room 304, Nilgiri Hostel"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-full bg-[#f2f3ff] border border-[#c3c5d8] focus:bg-white focus:border-[#003bbe] text-[#131b2e] text-xs outline-none transition"
                />
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#131b2e] mb-1">Detailed Description *</label>
            <textarea
              required
              rows={4}
              placeholder="Describe what is broken, when it occurred, and any hazards technicians need to know..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-[#f2f3ff] border border-[#c3c5d8] focus:bg-white focus:border-[#003bbe] text-[#131b2e] text-xs outline-none transition leading-relaxed resize-none"
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-xs font-bold text-[#131b2e] mb-1">
              Issue Photo (Online Storage - Vercel Blob)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {photoUrl ? (
              <div className="relative inline-block rounded-xl overflow-hidden border border-[#dae2fd] group">
                <img src={photoUrl} alt="Issue preview" className="w-28 h-28 object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white hover:bg-rose-500 transition shadow"
                  title="Remove image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#c3c5d8] hover:border-[#003bbe] rounded-2xl p-4 text-center cursor-pointer transition bg-[#f2f3ff]"
              >
                {uploadingPhoto ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-[#003bbe]">
                    <span className="w-4 h-4 border-2 border-[#003bbe]/30 border-t-[#003bbe] rounded-full animate-spin"></span>
                    <span>Uploading photo to online cloud storage...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-xs text-[#434656]">
                    <Upload className="w-5 h-5 text-[#003bbe]" />
                    <span className="font-semibold text-[#131b2e]">Upload photo proof</span>
                    <span className="text-[10px] text-slate-400">PNG, JPG up to 10MB</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Notice */}
          <div className="p-3 rounded-xl bg-[#eaedff] border border-[#dae2fd] text-[#00397f] text-xs flex items-start gap-2">
            <Cpu className="w-4 h-4 text-[#003bbe] shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Upon submission, Gemini AI inspects clarity, categorizes priority, and generates instructions for facility workers.
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#eaedff]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 hover:text-black hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingPhoto}
              className="px-6 py-2.5 rounded-full bg-[#003bbe] hover:bg-[#1150ef] disabled:opacity-50 text-white font-bold text-xs shadow-md flex items-center gap-2 transition cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>AI Triage Running...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Submit Issue</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
