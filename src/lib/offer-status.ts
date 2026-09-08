import type { OfferStatus } from "@prisma/client";

export const OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  DRAFT: ["SENT", "ACCEPTED"],
  SENT: ["ACCEPTED", "REJECTED", "EXPIRED", "DRAFT"],
  ACCEPTED: ["SENT", "REJECTED"],
  REJECTED: ["SENT", "DRAFT"],
  EXPIRED: ["SENT", "DRAFT"],
  INVOICED: [],
};
