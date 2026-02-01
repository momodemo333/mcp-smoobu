// ── Smoobu API raw response types ──

export interface SmoobuUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface SmoobuApartmentListItem {
  id: number;
  name: string;
}

export interface SmoobuApartment {
  id: number;
  name: string;
  location: {
    street: string;
    zip: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  timeZone: string;
  rooms: {
    maxOccupancy: number;
    bedrooms: number;
    bathrooms: number;
    doubleBeds: number;
    singleBeds: number;
    sofaBeds: number;
    couches: number;
    childBeds: number;
    queenSizeBeds: number;
    kingSizeBeds: number;
  };
  amenities: string[];
  currency: string;
  price: {
    minimal: number;
    maximal: number;
  };
  type: {
    id: number;
    name: string;
  };
}

export interface SmoobuReservation {
  id: number;
  "reference-id": string;
  type: string;
  arrival: string;
  departure: string;
  "created-at": string;
  "modified-at"?: string;
  apartment: {
    id: number;
    name: string;
  };
  channel: { id: number; name: string };
  "guest-name": string;
  email: string;
  phone: string;
  adults: number;
  children: number;
  "check-in": string;
  "check-out": string;
  notice: string;
  price: number;
  "price-paid": number;
  prepayment: number;
  "prepayment-paid": number;
  deposit: number;
  "deposit-paid": number;
  language: string;
  "guest-app-url": string;
  "is-blocked-booking": boolean;
  guestId: number;
}

export interface SmoobuPaginatedResponse<T> {
  page_count: number;
  page_size: number;
  total_items: number;
  page: number;
  [key: string]: T[] | number;
}

export interface SmoobuPriceElement {
  id: number;
  type: string;
  name: string;
  amount: number;
  quantity: number;
  tax: number;
  currencyCode: string;
  sortOrder: number;
  priceIncludedInId: number | null;
}

export interface SmoobuPlaceholder {
  key: string;
  value: string;
}

export interface SmoobuGuest {
  id: number;
  firstName: string;
  lastName: string;
  companyName: string;
  emails: string[];
  telephoneNumbers: string[];
  address: {
    street: string;
    postalCode: string;
    location: string;
    country: string;
  };
  notes: string;
  bookings: Array<{ id: number }>;
}

export interface SmoobuMessage {
  id: number;
  subject: string;
  message: string;
  messageHtml: string;
  type: string;
}

export interface SmoobuThread {
  booking: { id: number; guest_name: string };
  apartment: { id: number; name: string };
  latest_message: {
    id: number;
    subject: string;
    text_content: string;
    html_content: string;
    created_at: string;
  };
}

export interface SmoobuRateDay {
  price: number;
  min_length_of_stay: number;
  available: number;
}

export interface SmoobuAddon {
  id: number;
  name: string;
  apartments: number[];
  amount: number;
  usePercentage: boolean;
  tax: number;
  calculationType: string;
  optional: boolean;
  maxQuantity: number;
  whereVisible: string;
}

export interface SmoobuCustomPlaceholder {
  id: number;
  key: string;
  defaultValue: string;
  type: string;
  foreignId: number | null;
}

export interface SmoobuTranslation {
  id: number;
  locale: string;
  value: string;
}

export interface SmoobuOnlineCheckIn {
  id: number;
  booking_id: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// ── Simplified response types (returned to LLM) ──

export interface SimplifiedReservation {
  id: number;
  referenceId: string;
  type: string;
  arrival: string;
  departure: string;
  apartmentId: number;
  apartmentName: string;
  channel: string;
  guestName: string;
  adults: number;
  children: number;
  price: number;
  isBlocked: boolean;
}

export interface SimplifiedGuest {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  bookingsCount: number;
}

export interface SimplifiedThread {
  booking: { id: number; guestName: string };
  apartment: { id: number; name: string };
  latestMessage: {
    id: number;
    subject: string;
    textContent: string;
    createdAt: string;
  };
}

export interface SimplifiedCheckIn {
  id: number;
  bookingId: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}
