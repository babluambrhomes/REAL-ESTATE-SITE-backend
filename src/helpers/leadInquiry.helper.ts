import type { Prisma } from "../generated/prisma/client";

export const RECENT_ACTIVITY_LIMIT = 50;
const DEFAULT_VISIT_MINUTES = 60;
export const VISIT_DURATION_MS = DEFAULT_VISIT_MINUTES * 60 * 1000;

export type ActivityAction =
  | "CREATED"
  | "STATUS_CHANGED"
  | "COMMENT_ADDED"
  | "ASSIGNED"
  | "RESCHEDULED"
  | "CANCELLED";

export type ActivityEntry = {
  action: ActivityAction;
  at: string;
  byUserId: string | null;
  from: string | null;
  to: string | null;
  note: string | null;
};

type BuildActivityInput = {
  action: ActivityAction;
  byUserId?: string | null;
  from?: string | null;
  to?: string | null;
  note?: string | null;
};

export const buildActivity = (input: BuildActivityInput): ActivityEntry => ({
  action: input.action,
  at: new Date().toISOString(),
  byUserId: input.byUserId ?? null,
  from: input.from ?? null,
  to: input.to ?? null,
  note: input.note ?? null,
});

export const appendComment = async (
  tx: Prisma.TransactionClient,
  id: string,
  text: string
): Promise<void> => {
  await tx.leadInquiry.update({
    where: { id },
    data: { comments: { push: text } },
  });
};

export const pushRecentActivity = async (
  tx: Prisma.TransactionClient,
  id: string,
  entry: ActivityEntry
): Promise<void> => {
  const payload = JSON.stringify([entry]);

  await tx.$executeRaw`
    UPDATE lead_inquiries
    SET recent_activity = (
      SELECT COALESCE(jsonb_agg(e ORDER BY ord ASC), '[]'::jsonb)
      FROM (
        SELECT e, ord
        FROM jsonb_array_elements(
          COALESCE(recent_activity, '[]'::jsonb) || ${payload}::jsonb
        ) WITH ORDINALITY AS t(e, ord)
        ORDER BY ord DESC
        LIMIT ${RECENT_ACTIVITY_LIMIT}
      ) trimmed
    )
    WHERE id = ${id}::uuid
  `;
};
