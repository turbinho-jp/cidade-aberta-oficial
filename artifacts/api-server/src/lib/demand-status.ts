export type DemandStatus =
  | "open"
  | "under_review"
  | "approved"
  | "in_progress"
  | "completed"
  | "rejected"
  | "closed";

export const DEMAND_TRANSITIONS: Record<DemandStatus, DemandStatus[]> = {
  open: ["under_review", "rejected", "closed"],
  under_review: ["approved", "rejected"],
  approved: ["in_progress", "rejected", "closed"],
  in_progress: ["completed", "approved"],
  completed: ["in_progress", "closed"],
  rejected: ["open"],
  closed: [],
};

export function canTransition(from: string, to: string): boolean {
  const allowed = DEMAND_TRANSITIONS[from as DemandStatus];
  if (!allowed) return false;
  return allowed.includes(to as DemandStatus);
}