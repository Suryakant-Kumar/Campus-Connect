export type UserRole = 'user' | 'worker' | 'co_admin' | 'admin' | 'founder';

export type CampusType = 'university' | 'school' | 'hostel' | 'pg' | 'residential_society' | 'other';

export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'rejected';

export type IssueUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface Campus {
  id: string;
  name: string;
  slug: string;
  type: CampusType;
  status?: 'active' | 'suspended';
  description?: string;
  address?: string;
  city?: string;
  contact_email?: string;
  created_at: string;
  member_count?: number;
  open_issues_count?: number;
  resolved_issues_count?: number;
  total_issues_count?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  campusId: string | null;
  campusSlug: string | null;
  department?: string | null;
  phone?: string | null;
}

export interface AIAnalysis {
  clarityScore: number;
  improvedTitle: string;
  suggestedCategory: string;
  urgency: IssueUrgency;
  urgencyReason: string;
  isFlagged: boolean;
  flagReason: string | null;
  actionableSummary: string;
  tags: string[];
  aiProvider: 'gemini' | 'keyword_fallback';
}

export interface Issue {
  id: string;
  campus_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string;
  category: string;
  location: string;
  photo_url?: string | null;
  status: IssueStatus;
  urgency: IssueUrgency;
  ai_analysis?: AIAnalysis | null;
  ai_flagged?: boolean;
  ai_flag_reason?: string | null;
  resolution_notes?: string | null;
  resolution_photo_url?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  creator_email?: string;
  worker_name?: string | null;
  worker_department?: string | null;
  upvotes_count: number;
  has_upvoted: boolean;
  comments_count: number;
}

export interface IssueComment {
  id: string;
  issue_id: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  user_department?: string | null;
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string | null;
  phone?: string | null;
  created_at: string;
  active_assigned_count?: number;
  resolved_count?: number;
}

export interface CampusStats {
  statusCounts: { status: IssueStatus; count: string }[];
  urgencyCounts: { urgency: IssueUrgency; count: string }[];
  categoryCounts: { category: string; count: string }[];
  memberCounts: { role: UserRole; count: string }[];
}

export interface FounderAnalytics {
  totalCampuses: number;
  totalUsers: number;
  totalIssues: number;
  resolvedIssues: number;
  totalUpvotes: number;
  totalComments: number;
}
