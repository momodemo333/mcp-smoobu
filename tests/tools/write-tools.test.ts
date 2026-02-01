import { describe, it, expect, vi, beforeEach } from "vitest";
import { SmoobuClient } from "../../src/smoobu-client.js";
import { sendReservationMessage } from "../../src/tools/messages.js";
import { createGuest, updateGuest } from "../../src/tools/guests.js";
import { createReservation, updateReservation, cancelReservation } from "../../src/tools/reservations.js";
import { checkApartmentAvailability, updateRates } from "../../src/tools/rates.js";
import { createPriceElement, updatePriceElement, deletePriceElement } from "../../src/tools/price-elements.js";

// Mock SmoobuClient - we never make real API calls
const mockClient = {
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

  it("calls mutate with valid params", async () => {
    await checkApartmentAvailability(mockClient, {
      apartmentId: 1, arrivalDate: "2025-06-01", departureDate: "2025-06-05",
    });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "POST",
      "/booking/checkApartmentAvailability",
      expect.objectContaining({ apartments: [1] }),
    );
  });
});

// -- sendReservationMessage --

describe("sendReservationMessage", () => {
  it("rejects missing required params", async () => {
    expectValidationError(await sendReservationMessage(mockClient, {}));
  });

  it("rejects missing subject", async () => {
    expectValidationError(await sendReservationMessage(mockClient, {
      reservationId: 1, body: "hi",
    }));
  });

  it("calls mutate with valid params", async () => {
    await sendReservationMessage(mockClient, {
      reservationId: 123, subject: "Hello", body: "World",
    });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "POST",
      "/api/reservations/123/messages",
      { subject: "Hello", body: "World" },
    );
  });
});

// -- createGuest --

describe("createGuest", () => {
  it("rejects missing firstName", async () => {
    expectValidationError(await createGuest(mockClient, { lastName: "Doe" }));
  });

  it("rejects invalid email", async () => {
    expectValidationError(await createGuest(mockClient, {
      firstName: "John", lastName: "Doe", email: "not-email",
    }));
  });

  it("calls mutate with valid params", async () => {
    await createGuest(mockClient, { firstName: "John", lastName: "Doe" });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "POST", "/api/guests",
      { firstName: "John", lastName: "Doe" },
    );
  });
});

// -- updateGuest --

describe("updateGuest", () => {
  it("rejects missing guestId", async () => {
    expectValidationError(await updateGuest(mockClient, { firstName: "John" }));
  });

  it("rejects no fields to update", async () => {
    expectValidationError(await updateGuest(mockClient, { guestId: 1 }));
  });

  it("calls mutate with valid params", async () => {
    await updateGuest(mockClient, { guestId: 5, firstName: "Jane" });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "PUT", "/api/guests/5",
      { firstName: "Jane" },
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
      reservationId: 1, name: "Cleaning", amount: 50,
    });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "POST", "/api/reservations/1/price-elements",
      { name: "Cleaning", amount: 50 },
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
      reservationId: 1, elementId: 2, amount: 75,
    });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "POST", "/api/reservations/1/price-elements/2",
      { amount: 75 },
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
      apartments: [{
        id: 1,
        priceItems: [{ date: "2025-06-01", price: 100, available: 1 }],
      }],
    });
    expect(mockClient.mutate).toHaveBeenCalledWith(
      "PUT", "/api/rates",
      expect.objectContaining({
        apartments: expect.any(Array),
      }),
    );
  });
});
