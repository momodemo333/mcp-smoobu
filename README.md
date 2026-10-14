# mcp-smoobu

MCP server for the [public Smoobu API](https://docs.smoobu.com/). Version **0.2.0**, modernised against public documentation on **2026-10-14**. 29 tools: 18 GET-based reads, one read-only availability POST, two local pure tools, eight mutations.

## Safety and authentication

- Required: SMOOBU_API_KEY. Prefer HMAC with SMOOBU_API_SECRET (RFC3986 query encoding, fresh nonce/timestamp, exact body hash).
- Missing secret retains legacy Api-Key compatibility; documented sunset **2026-10-31**. No credentials are printed by diagnostics or HTTP errors.
- **Writes disabled by default**. SMOOBU_ALLOW_WRITES must equal true to enable supported mutations.
- Optional SMOOBU_WRITE_CATEGORIES is a comma-separated narrowing allowlist: rates,messages,reservations,price-elements. Unset preserves legacy global enable behavior. Empty/unknown categories permit no matching writes; it never overrides writes=false.
- Availability uses a dedicated read-only POST to its fixed documented path and resolves customerId with GET /api/me. It works with writes disabled.
- SMOOBU_API_URL defaults to https://login.smoobu.com; only HTTPS origins accepted, with HTTP loopback for tests. Redirects and foreign-origin request paths refused.
- 700 requests/minute local sliding window, deadline 30 seconds including waits, max two retries for reads only. Retry-After and Smoobu Unix reset header honored. **Mutations are never automatically retried**, including 429, timeout and ambiguous 5xx/network failure. Re-read before manual retry.

## Breaking contract corrections

**update_rates** now accepts the documented POST body; old apartments objects/priceItems/price/available are rejected, not translated:

~~~json
{
  "apartments": [123],
  "operations": [{
    "dates": ["2026-12-01:2026-12-03", "2026-12-05"],
    "daily_price": 120,
    "min_length_of_stay": 2
  }]
}
~~~

Call **preview_rates** with the same shape first. Pure validation/payload only: no network, current-state snapshot, recommendation, approval or concurrency guarantee. Minimum-only changes require a pre-existing price; rates do not change availability. Prices may propagate to price-sync-enabled channels. Local caps and overlap rejection are documented in the coverage report. list_rates now requires explicit apartment IDs.

Other corrections:
- update_reservation accepts documented guestName/guestEmail/guestPhone and booking/payment fields. No undocumented date/property/channel/address edits; no implicit mapping from firstName/email. It does **not** accept Airbnb alteration requests.
- create_reservation.address is an object, not a string; country is a separate optional field.
- create/update_price_element require name, amount and currencyCode. Update method remains POST (as documented), not PUT; partial updates not promised.
- send_reservation_message has optional subject, nonblank body and no undocumented templateId.
- create_guest, update_guest and list_online_check_ins removed: public contracts not documented. Actual OCI is partner-only.
- list_guests uses page/pageSize and camelCase response metadata. Apartment-filtered addons use /api/addons/{id}.

## Tools

- Account/properties: get_user, list_apartments, get_apartment.
- Bookings: list_reservations, get_reservation, get_reservation_price_elements, get_reservation_placeholders, check_apartment_availability; create_reservation, update_reservation, cancel_reservation.
- Guests: list_guests, get_guest (read-only).
- Messages: list_threads, list_reservation_messages, send_reservation_message.
- Rates: list_rates, preview_rates, update_rates.
- Pricing components: get_price_element, create_price_element, update_price_element, delete_price_element; list_addons.
- Templates: list_custom_placeholders, get_custom_placeholder (includes translations).
- Integration: list_webhooks, get_webhook (read-only metadata; callback origin only to avoid leaking path/query credentials), get_capabilities (local effective permissions).

Lists are paged, not silently aggregated. Messages expose nextPage, onlyRelatedToGuest, safe text fallback from both HTML aliases and truncation metadata. maxContentChars defaults 4000 per message (100..100000). HTML extraction never executes content; output is untrusted plain text, not HTML safe to render. unreadMessages is an aggregate, **not** a count of conversations needing replies. No mark-read/no_reply_needed or Airbnb request workflow is available.

## Local development without touching production dist

Dependencies already installed for this review; no dependency change was required.

~~~bash
npm run typecheck
npm run build:staging
npm test
~~~

Staging: .staging/modernisation-2026-10-14/index.js. The MCP integration test starts it with dummy credentials and a loopback HTTP fixture; unit tests use fake fetch. Rebuild staging before tests after source edits. For deployment, run `npm run build` then restart your MCP client connection so it launches the updated `dist/index.js`. Existing processes keep their loaded version. Preserve your authentication and write-policy environment. A controlled live rate change and restoration were verified on 2026-10-14; other mutation types and downstream channel propagation are not thereby proven.

- [Full endpoint/tool coverage and limitations](docs/coverage-2026-10-14.md)
- [Joint live-test checklist](docs/joint-live-test.md)

## License
[MIT](LICENSE) © Morgan Demoulin

## Revue ciblée complémentaire

Les annulations MCP sont propagées à tous les appels HTTP, y compris les deux étapes disponibilité et les attentes quota. Une mutation déjà envoyée reste potentiellement ambiguë. Les réponses vides/204 non documentées et confirmations mutation invalides sont rejetées sans retry; les listes exigent leur tableau et métadonnées de pagination, sans inventer une page vide. Les traductions placeholders sont aplaties depuis leur enveloppe documentée.
