import { db, activityLogTable } from "@workspace/db";

type ActivityType = "demand_created" | "demand_resolved" | "comment_added" | "status_changed" | "service_order_created" | "confirmation_added";

export async function logActivity(params: {
  type: ActivityType;
  description: string;
  demandId?: number;
  demandTitle?: string;
  actorName?: string;
  neighborhoodName?: string;
}) {
  try {
    await db.insert(activityLogTable).values({
      type: params.type,
      description: params.description,
      demandId: params.demandId,
      demandTitle: params.demandTitle,
      actorName: params.actorName,
      neighborhoodName: params.neighborhoodName,
    });
  } catch {
    // Non-critical, don't throw
  }
}
