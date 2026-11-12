import { z } from "zod";
import {
  ACTION_TYPES,
  MAX_ACTIONS,
  MAX_PER_HOUR_LIMIT,
  TRIGGERS,
  TRIGGER_ACTIONS,
} from "@/modules/automation/constants";

const recipient = z.union([z.literal("owner"), z.uuid()]);

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("assign_owner"),
    /** Satu id = tetap; beberapa id = bergiliran (round-robin). */
    userIds: z.array(z.uuid()).min(1, "Pilih minimal satu pengguna").max(20),
    onlyIfUnassigned: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("create_task"),
    subject: z.string().trim().min(3, "Subjek task minimal 3 karakter").max(160),
    dueInDays: z.number().int().min(0).max(365).default(1),
    assignTo: recipient.default("owner"),
  }),
  z.object({
    type: z.literal("send_notification"),
    title: z.string().trim().min(3, "Judul notifikasi minimal 3 karakter").max(160),
    body: z.string().trim().max(500).optional(),
    to: recipient.default("owner"),
  }),
]);
export type AutomationAction = z.output<typeof actionSchema>;

const ruleBase = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(100),
  trigger: z.enum(TRIGGERS),
  actions: z.array(actionSchema).min(1, "Tambahkan minimal satu aksi").max(MAX_ACTIONS),
  maxPerHour: z.number().int().min(1).max(MAX_PER_HOUR_LIMIT).default(100),
  isActive: z.boolean().default(true),
});

function checkActions(
  v: { trigger: (typeof TRIGGERS)[number]; actions: { type: (typeof ACTION_TYPES)[number] }[] },
  ctx: z.RefinementCtx,
) {
  const allowed = TRIGGER_ACTIONS[v.trigger];
  v.actions.forEach((a, i) => {
    if (!allowed.includes(a.type))
      ctx.addIssue({
        code: "custom",
        path: ["actions", i],
        message: "Aksi ini tidak tersedia untuk trigger tersebut",
      });
  });
}

export const ruleSchema = ruleBase.superRefine(checkActions);
export type RuleInput = z.input<typeof ruleSchema>;
export const updateRuleSchema = ruleBase.extend({ id: z.uuid() }).superRefine(checkActions);
export const toggleRuleSchema = z.object({ id: z.uuid(), isActive: z.boolean() });
