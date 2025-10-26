// Zod schema for validation (TypeScript/JS via zod)
import { z } from "zod";

const zDateFlex = z.preprocess(
  (v) => (typeof v === "string" ? new Date(v) : v),
  z.date()
);

const zNumFlex = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (v && typeof v === "object" && "$numberInt" in (v as any)) {
    return Number((v as any).$numberInt);
  }
  return v;
}, z.number());

export const ImageSchema = z.object({
  url: z.string().min(1),
  role: z.enum(["hero", "gallery", "floorplan", "amenity", "view"]).default("gallery"),
  alt: z.string().default(""),
  caption: z.string().default(""),
  order: z.number().int().min(0).default(0),
});

export const CalendarSchema = z.object({
  calendarId: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().nonnegative(),
  effectiveDate: z.string().min(1), // ISO date (YYYY-MM-DD); tighten with regex if desired
});

export const AmenitiesSchema = z.object({
  raw: z.array(z.string()).default([]),
  wellness: z.array(z.string()).default([]),
  bath: z.array(z.string()).default([]),
  kitchenette: z.array(z.string()).default([]),
  outdoor: z.array(z.string()).default([]),
  tech: z.array(z.string()).default([]),
  view: z.array(z.string()).default([]),
  room: z.array(z.string()).default([]),
  services: z.array(z.string()).default([]),
  accessibility: z.array(z.string()).default([]),
});

export const PoliciesSchema = z.object({
  checkInTime: z.string().default("15:00"),
  checkOutTime: z.string().default("11:00"),
  smoking: z.enum(["prohibited", "permitted"]).default("prohibited"),
  pets: z.object({
    allowed: z.boolean().default(false),
    notes: z.string().default(""),
  }),
  cancellation: z.object({
    windowHours: z.number().int().nullable().default(null),
    penaltyType: z.string().nullable().default(null), // "firstNight" | "percentage" etc.
    penaltyValue: z.number().nullable().default(null),
  }),
  securityDeposit: z.object({
    required: z.boolean().default(false),
    amount: z.number().nullable().default(null),
    currency: z.string().default("USD"),
  }),
  minStayNights: z.number().int().nullable().default(null),
});

export const TechSchema = z.object({
  wifi: z.object({
    available: z.boolean().default(true),
    bandwidthMbps: z.number().nullable().default(null),
  }),
  tv: z.object({
    available: z.boolean().default(true),
    sizeInches: z.number().nullable().default(null),
    channels: z.array(z.string()).default([]),
    casting: z.boolean().default(true),
  }),
  audio: z.object({
    bluetoothSpeaker: z.boolean().default(false),
  }),
  smartHome: z.object({
    voiceAssistant: z.boolean().default(false),
    smartThermostat: z.boolean().default(false),
  }),
});

export const SafetySchema = z.object({
  smokeDetector: z.boolean().default(true),
  carbonMonoxideDetector: z.boolean().default(true),
  fireExtinguisher: z.boolean().default(true),
  firstAidKit: z.boolean().default(true),
  emergencyInfo: z.string().default(""),
});

export const HousekeepingSchema = z.object({
  cleaningFrequency: z.enum(["daily", "everyOtherDay", "onRequest"]).default("daily"),
  linensChange: z.enum(["daily", "everyOtherDay", "onRequest"]).default("everyOtherDay"),
  towelsChange: z.enum(["daily", "everyOtherDay", "onRequest"]).default("daily"),
  turnDownService: z.boolean().default(false),
});

export const FeesTaxesSchema = z.object({
  resortFee: z.object({
    amount: z.number().nullable().default(null),
    currency: z.string().default("USD"),
    per: z.enum(["night", "stay"]).default("night"),
  }),
  cleaningFee: z.object({
    amount: z.number().nullable().default(null),
    currency: z.string().default("USD"),
    per: z.enum(["night", "stay"]).default("stay"),
  }),
  taxes: z.array(
    z.object({
      name: z.string(),
      rate: z.number(), // 0.07 = 7%
    })
  ).default([]),
});

export const LuxuryUnitSchema = z.object({
  _id: z.string().min(1),
  name: z.string().min(1),
  unitNumber: z.string().min(1),
  type: z.literal("villa"), // adjust to z.enum([...]) if you’ll add more types
  description: z.string().min(1),
  rate: z.number().nonnegative(),
  currency: z.string().default("USD"),

  config: z.object({
    squareFeet: z.number().int().positive(),
    view: z.string().min(1),
    beds: z.array(
      z.object({
        size: z.string().min(1),
        count: z.number().int().positive(),
      })
    ),
    bedrooms: z.number().int().positive(),
    bathrooms: z.number().int().positive(),
    shower: z.boolean(),
    bathtub: z.boolean(),
    hotTub: z.boolean(),
    sauna: z.boolean(),
    ada: z.boolean(),
  }),

  calendars: z.array(CalendarSchema),

  active: z.boolean(),
  createdAt: zDateFlex,
  updatedAt: zDateFlex,
  __v: z.number().int().nonnegative(),
  unit_id: z.string().min(1),
  tenantId: z.string().min(1),

  slug: z.string().min(1),

  occupancy: z.object({
    sleeps: z.number().int().positive(),
    maxAdults: z.number().int().nonnegative(),
    maxChildren: z.number().int().nonnegative(),
    extraBedAvailable: z.boolean(),
    cribAvailable: z.boolean(),
  }).optional(),

  amenities: AmenitiesSchema,

  location: z.object({
    displayAddress: z.string().default(""),
    unitPositionNotes: z.string().default(""),
    floorLevel: z.number().int().nullable().default(null),
    city: z.string().default(""),
    state: z.string().default(""),
    coordinates: z.object({
      lat: z.number().nullable().default(null),
      lng: z.number().nullable().default(null),
    }),
    wayfinding: z.array(z.string()).default([]),
  }).optional(),

  images: z.array(ImageSchema).optional(),

  policies: PoliciesSchema,
  tech: TechSchema,
  safety: SafetySchema,
  housekeeping: HousekeepingSchema,
  feesAndTaxes: FeesTaxesSchema,

  ratePlans: z
    .array(
      z.object({
        code: z.string(),
        name: z.string(),
        currency: z.string().default("USD"),
        baseRate: z.number().nonnegative(),
        included: z.array(z.string()).default([]),
        cancellationPolicyRef: z.string().nullable().default(null),
      })
    )
    .default([]),

  labels: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),

  seo: z.object({
    slug: z.string(),
    title: z.string(),
    metaDescription: z.string(),
  }),

  metadata: z.object({
    schemaVersion: z.string(),
    source: z.string(),
    sourceNotes: z.object({
      secondaryDocId: z.string(),
      secondaryType: z.string(),
      secondaryCreatedAt: z.string(),
      secondaryUpdatedAt: z.string(),
      secondaryDescription: z.string(),
      secondaryRate: z.number(),
      conflictsResolved: z.record(z.string(), z.string()),
    }),
  }),
});

export type LuxuryUnit = z.infer<typeof LuxuryUnitSchema>;

// Room.tsx
export type UnitDoc = LuxuryUnit;