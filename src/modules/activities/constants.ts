export const ACTIVITY_TYPES = ["task", "call", "meeting", "email", "note"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  task: "Task",
  call: "Call",
  meeting: "Meeting",
  email: "Email",
  note: "Catatan",
};
export const ACTIVITY_STATUSES = ["open", "done", "cancelled"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];
export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  open: "Terbuka",
  done: "Selesai",
  cancelled: "Dibatalkan",
};
export const ACTIVITY_BUCKETS = ["overdue", "upcoming", "done"] as const;
export type ActivityBucket = (typeof ACTIVITY_BUCKETS)[number];
export type ActivityLink = {
  leadId?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
};
