export type UserRole = "franchisee" | "regional_manager" | "admin";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  franchisee_id: string | null;
  assigned_states: string[];
}

export interface Franchisee {
  id: string;
  business_name: string;
  owner_name: string;
  ic_number: string;
  contact: string;
  email: string | null;
  agreement_start: string;
  agreement_end: string;
  status: "active" | "suspended" | "expired" | "pending";
  risk_flag: boolean;
}

export interface Outlet {
  id: string;
  franchisee_id: string;
  outlet_code: string;
  location: string;
  state: string;
  opening_date: string;
  monthly_target: number;
  monthly_actual: number;
}

export interface Royalty {
  id: string;
  outlet_id: string;
  period: string;
  gross_sales: number;
  royalty_amount: number;
  marketing_fee: number;
  due_date: string;
  paid_at: string | null;
  status: "pending" | "paid" | "overdue";
}

export interface SalesReport {
  id: string;
  outlet_id: string;
  report_date: string;
  gross_sales: number;
  transactions: number;
  notes: string | null;
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  materials_url: string | null;
  category: string;
  passing_score: number;
}

export interface TrainingProgress {
  id: string;
  user_id: string;
  module_id: string;
  completed_at: string | null;
  score: number | null;
  attempts: number;
}

export interface ComplianceAudit {
  id: string;
  outlet_id: string;
  audit_date: string;
  score: number;
  checklist_items: Array<{ item: string; pass: boolean; note?: string }>;
  auditor: string;
  signed_off_by: string | null;
  risk_flag: boolean;
  notes: string | null;
}

export interface MarketingAsset {
  id: string;
  title: string;
  category: string;
  file_url: string;
  thumbnail_url: string | null;
  file_type: string;
}

export interface SupportTicket {
  id: string;
  outlet_id: string | null;
  category: string;
  subject: string;
  description: string;
  photo_url: string | null;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  publish_at: string;
  target_role: UserRole | null;
}
