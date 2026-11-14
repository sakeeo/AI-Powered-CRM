export const TRIGGERS = ["lead_created", "deal_won", "task_due", "quotation_expiring"] as const;
export type Trigger = (typeof TRIGGERS)[number];

export const TRIGGER_LABEL: Record<Trigger, string> = {
  lead_created: "Lead dibuat",
  deal_won: "Deal Won",
  task_due: "Task jatuh tempo",
  quotation_expiring: "Quotation mendekati kedaluwarsa",
};

/** Entitas yang menjadi konteks tiap trigger. */
export const TRIGGER_ENTITY = {
  lead_created: "lead",
  deal_won: "deal",
  task_due: "activity",
  quotation_expiring: "quotation",
} as const satisfies Record<Trigger, string>;

export const ACTION_TYPES = ["assign_owner", "create_task", "send_notification"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_LABEL: Record<ActionType, string> = {
  assign_owner: "Tugaskan PIC",
  create_task: "Buat task",
  send_notification: "Kirim notifikasi",
};

/** Aksi yang bermakna per trigger: assign owner hanya untuk lead & deal (entitas ber-owner utama). */
export const TRIGGER_ACTIONS: Record<Trigger, readonly ActionType[]> = {
  lead_created: ["assign_owner", "create_task", "send_notification"],
  deal_won: ["assign_owner", "create_task", "send_notification"],
  task_due: ["create_task", "send_notification"],
  quotation_expiring: ["create_task", "send_notification"],
};

export const RUN_STATUS_LABEL: Record<string, string> = {
  running: "Berjalan",
  success: "Sukses",
  failed: "Gagal",
  rate_limited: "Dibatasi laju",
};
export const RUN_STATUS_TONE: Record<string, "blue" | "green" | "red" | "orange"> = {
  running: "blue",
  success: "green",
  failed: "red",
  rate_limited: "orange",
};

export const MAX_ACTIONS = 5;
export const DEFAULT_MAX_PER_HOUR = 100;
export const MAX_PER_HOUR_LIMIT = 1000;
