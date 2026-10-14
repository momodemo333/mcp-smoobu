import { describe, it, expect, vi, beforeEach } from "vitest";
import { SmoobuClient } from "../../src/smoobu-client.js";
import { sendReservationMessage } from "../../src/tools/messages.js";
import { createReservation, updateReservation, cancelReservation } from "../../src/tools/reservations.js";
import { checkApartmentAvailability, updateRates } from "../../src/tools/rates.js";
import { createPriceElement, updatePriceElement, deletePriceElement } from "../../src/tools/price-elements.js";

// Mock SmoobuClient - we never make real API calls
const mockClient = {
  checkAvailability: vi.fn().mockResolvedValue({ availableApartments: [1] }),
  mutate: vi.fn().mockResolvedValue({ id: 1 }),
  request: vi.fn().mockResolvedValue({ id: 1 }),
} as unknown as SmoobuClient;

beforeEach(() => {
  vi.clearAllMocks();
});

function expectValidationError(result: unknown) {
  expect(result).toHaveProperty("error", true);
  expect(result).toHaveProperty("code", "VALIDATION_ERROR");
}

// -- checkApartmentAvailability --

describe("checkApartmentAvailability", () => {
  it("rejects missing required params", async () => {
    expectValidationError(await checkApartmentAvailability(mockClient, {}));
  });

  it("rejects invalid date format", async () => {
    expectValidationError(await checkApartmentAvailability(mockClient, {
      apartmentId: 1, arrivalDate: "bad", departureDate: "2025-01-10",
    }));
  });

  it("rejects departure before arrival", async () => {
    expectValidationError(await checkApartmentAvailability(mockClient, {
      apartmentId: 1, arrivalDate: "2025-01-10", departureDate: "2025-01-05",
    }));
  });

  it("resolves customer and calls read-only POST", async () => {
    await checkApartmentAvailability(mockClient, {
      apartmentId: 1, arrivalDate: "2025-06-01", departureDate: "2025-06-05",
    });
    expect(mockClient.checkAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ apartments: [1], customerId: 1 }),
    );
  });
});

// -- sendReservationMessage --

describe("sendReservationMessage", () => {
  it("rejects missing required params", async () => {
    expectValidationError(await sendReservationMessage(mockClient, {}));
  });

  it("rejects empty body", async () => {
    expectValidationError(await sendReservationMessage(mockClient, {
      reservationId: 1, body: " ",
    }));
  });

  it("calls mutate with valid params", async () => {
    await sendReservationMessage(mockClient, {
      reservationId: 123, subject: "Hello", body: "World",
    });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "POST",
      "/api/reservations/123/messages/send-message-to-guest",
      { subject: "Hello", messageBody: "World" },
    );
  });
});

// -- createReservation --

describe("createReservation", () => {
  it("rejects missing required params", async () => {
    expectValidationError(await createReservation(mockClient, {}));
  });

  it("rejects departure before arrival", async () => {
    expectValidationError(await createReservation(mockClient, {
      arrivalDate: "2025-06-10", departureDate: "2025-06-05", apartmentId: 1,
    }));
  });

  it("rejects invalid time format", async () => {
    expectValidationError(await createReservation(mockClient, {
      arrivalDate: "2025-06-01", departureDate: "2025-06-05",
      apartmentId: 1, arrivalTime: "2pm",
    }));
  });

  it("rejects negative price", async () => {
    expectValidationError(await createReservation(mockClient, {
      arrivalDate: "2025-06-01", departureDate: "2025-06-05",
      apartmentId: 1, price: -100,
    }));
  });

  it("defaults channelId to 70", async () => {
    await createReservation(mockClient, {
      arrivalDate: "2025-06-01", departureDate: "2025-06-05", apartmentId: 1,
    });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "POST", "/api/reservations",
      expect.objectContaining({ channelId: 70 }),
    );
  });
});

// -- updateReservation --

describe("updateReservation", () => {
  it("rejects missing reservationId", async () => {
    expectValidationError(await updateReservation(mockClient, { price: 100 }));
  });

  it("rejects no fields to update", async () => {
    expectValidationError(await updateReservation(mockClient, { reservationId: 1 }));
  });

  it("calls mutate with valid params", async () => {
    await updateReservation(mockClient, { reservationId: 1, price: 200 });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "PUT", "/api/reservations/1",
      { price: 200 },
    );
  });
});

// -- cancelReservation --

describe("cancelReservation", () => {
  it("rejects missing reservationId", async () => {
    expectValidationError(await cancelReservation(mockClient, {}));
  });

  it("rejects invalid reservationId", async () => {
    expectValidationError(await cancelReservation(mockClient, { reservationId: -1 }));
  });

  it("calls mutate DELETE", async () => {
    await cancelReservation(mockClient, { reservationId: 42 });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "DELETE", "/api/reservations/42",
    );
  });
});

// -- createPriceElement --

describe("createPriceElement", () => {
  it("rejects missing required params", async () => {
    expectValidationError(await createPriceElement(mockClient, {}));
  });

  it("rejects negative amount", async () => {
    expectValidationError(await createPriceElement(mockClient, {
      reservationId: 1, name: "Tax", amount: -10,
    }));
  });

  it("calls mutate with valid params", async () => {
    await createPriceElement(mockClient, {
      reservationId: 1, name: "Cleaning", amount: 50, currencyCode: "EUR",
    });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "POST", "/api/reservations/1/price-elements",
      { name: "Cleaning", amount: 50, currencyCode: "EUR" },
    );
  });
});

// -- updatePriceElement --

describe("updatePriceElement", () => {
  it("rejects missing required params", async () => {
    expectValidationError(await updatePriceElement(mockClient, {}));
  });

  it("rejects no fields to update", async () => {
    expectValidationError(await updatePriceElement(mockClient, {
      reservationId: 1, elementId: 2,
    }));
  });

  it("calls mutate POST (not PUT) per Smoobu API", async () => {
    await updatePriceElement(mockClient, {
      reservationId: 1, elementId: 2, amount: 75, name: "Tax", currencyCode: "EUR",
    });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "POST", "/api/reservations/1/price-elements/2",
      { amount: 75, name: "Tax", currencyCode: "EUR" },
    );
  });
});

// -- deletePriceElement --

describe("deletePriceElement", () => {
  it("rejects missing required params", async () => {
    expectValidationError(await deletePriceElement(mockClient, {}));
  });

  it("calls mutate DELETE", async () => {
    await deletePriceElement(mockClient, { reservationId: 1, elementId: 3 });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "DELETE", "/api/reservations/1/price-elements/3",
    );
  });
});

// -- updateRates --

describe("updateRates", () => {
  it("rejects missing apartments", async () => {
    expectValidationError(await updateRates(mockClient, {}));
  });

  it("rejects empty apartments array", async () => {
    expectValidationError(await updateRates(mockClient, { apartments: [] }));
  });

  it("rejects apartment without id", async () => {
    expectValidationError(await updateRates(mockClient, {
      apartments: [{ priceItems: [] }],
    }));
  });

  it("calls mutate with valid params", async () => {
    await updateRates(mockClient, {
      apartments: [1], operations: [{ dates: ["2025-06-01"], daily_price: 100 }],
    });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "POST", "/api/rates",
      expect.objectContaining({
        apartments: expect.any(Array),
      }),
    );
  });
});
