import { z } from "zod";

export const followUpSubject = z.object({
  type: z.enum(["lead", "contact", "company"]),
  id: z.uuid(),
});
export type FollowUpSubject = z.infer<typeof followUpSubject>;
