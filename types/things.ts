// /lib/types/things.ts
export type ThingDoc = {
  id: string;
  tenantId: string;
  type: "unit"|"policy"|"restaurant"|"spa_treatment"|"media";
  name: string;
  attributes: Record<string, any>; // rate, capacity, amenities, etc.
  media?: { kind: "image"|"video"; url: string; alt?: string }[];
  searchable?: boolean;
  updatedAt: string;
};
