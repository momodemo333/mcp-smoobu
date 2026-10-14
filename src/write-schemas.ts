import { z } from "zod";
import { validateDate, validateTimeFormat } from "./validation.js";
export const idSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const date = z.string().refine(v => !validateDate(v, "date"), "Invalid calendar date");
const time = z.string().refine(v => !validateTimeFormat(v, "time"), "Expected HH:MM (00:00..23:59)");
const money = z.number().finite().nonnegative();
const common = {
  arrivalTime: time.optional(), departureTime: time.optional(), notice: z.string().optional(),
  adults: z.number().int().nonnegative().optional(), children: z.number().int().nonnegative().optional(),
  price: money.optional(), priceStatus: z.union([z.literal(0), z.literal(1)]).optional(),
  prepayment: money.optional(), prepaymentStatus: z.union([z.literal(0), z.literal(1)]).optional(),
  deposit: money.optional(), depositStatus: z.union([z.literal(0), z.literal(1)]).optional(), language: z.string().optional(),
};
export const createReservationSchema = z.strictObject({
  arrivalDate: date, departureDate: date, apartmentId: idSchema, channelId: idSchema.optional(), ...common,
  firstName: z.string().optional(), lastName: z.string().optional(), email: z.email().optional(), phone: z.string().optional(),
  address: z.strictObject({ street: z.string().optional(), postalCode: z.string().optional(), location: z.string().optional() }).optional(), country: z.string().optional(),
}).refine(p => p.departureDate > p.arrivalDate, "departureDate must be after arrivalDate");
export const updateReservationSchema = z.strictObject({
  reservationId: idSchema, ...common, guestName: z.string().optional(), guestEmail: z.email().optional(), guestPhone: z.string().optional(), assistantNotice: z.string().optional(),
}).refine(p => Object.keys(p).some(k => k !== "reservationId"), "Provide a field to update");
const priceFields = {
  reservationId: idSchema, name: z.string().trim().min(1), amount: money, currencyCode: z.string().regex(/^[A-Z]{3}$/),
  type: z.enum(["basePrice", "cleaningFee", "addon", "longStayDiscount", "coupon"]).optional(),
  quantity: idSchema.optional(), tax: money.optional(), sortOrder: z.number().int().nonnegative().optional(), priceIncludedInId: idSchema.optional(),
};
export const createPriceElementSchema = z.strictObject(priceFields);
export const updatePriceElementSchema = z.strictObject({ ...priceFields, elementId: idSchema });
