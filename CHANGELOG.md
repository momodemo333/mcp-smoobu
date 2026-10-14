# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-10-14

### Fixed / breaking
- Rates use documented POST apartments IDs + operations; reject legacy priceItems/available. Required list-rate apartment IDs and nullable data envelope.
- Availability resolves customerId from /api/me and remains usable read-only.
- Correct guest pagination, addon filter path, booking update fields/address type, required price-element currency/full update fields.
- Remove undocumented guest create/update and generic OCI listing; remove message templateId.
- Strict calendar/time/finite-number/ID/payment validation; keep requested reservation price/related data.

### Added
- Pure preview_rates, get_capabilities, get_price_element, list_webhooks/get_webhook with callback URL redaction.
- Message HTML text fallback, onlyRelatedToGuest, nextPage, configurable bounded content with truncation metadata.
- Shared HTTP pipeline, RFC3986 signing, redirect/origin guard, cancellation/deadline, 700/min local quota, Retry-After/reset waits, bounded read retries; never retry mutations. Optional narrowing write categories, global default remains false.
- Fake-fetch contracts, loopback MCP discovery/errors, safe staging build/typecheck commands, coverage report and joint live-test procedure.

Validated with 165 automated tests, typecheck and MCP loopback checks. A controlled live rate change and restoration were verified; other live mutation types and downstream channel propagation remain unverified. Rebuild dist and restart MCP client connections to adopt this release. See README for breaking input-schema changes.

## [0.1.0] - 2026-02-01

### Added

- Initial release with 27 MCP tools for the Smoobu API
- **Read tools (16):** get_user, list_apartments, get_apartment, list_reservations, get_reservation, get_reservation_price_elements, get_reservation_placeholders, list_guests, get_guest, list_reservation_messages, list_threads, list_rates, list_addons, list_custom_placeholders, get_custom_placeholder, list_online_check_ins
- **Write tools (11):** check_apartment_availability, send_reservation_message, create_guest, update_guest, create_reservation, update_reservation, cancel_reservation, create_price_element, update_price_element, delete_price_element, update_rates
