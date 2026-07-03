# mcp-smoobu

[![npm version](https://img.shields.io/npm/v/mcp-smoobu.svg)](https://www.npmjs.com/package/mcp-smoobu)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for the [Smoobu](https://www.smoobu.com/) property management API. Provides **27 tools** (16 read + 11 write) to manage reservations, properties, guests, rates, and messages through the [Model Context Protocol](https://modelcontextprotocol.io/).

## Features

- **User** — Account information
- **Properties** — List and inspect apartments
- **Reservations** — Create, update, cancel, list, and check availability
- **Guests** — Create, update, list guest profiles
- **Messages** — Send messages, list threads and conversation history
- **Rates** — Read and update pricing rates
- **Addons** — List available add-ons
- **Placeholders** — Custom and reservation placeholders
- **Check-in** — Online check-in data
- **Price Elements** — Create, update, delete price elements on reservations

## Quick Start

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "smoobu": {
      "command": "npx",
      "args": ["-y", "mcp-smoobu"],
      "env": {
        "SMOOBU_API_KEY": "your-api-key",
        "SMOOBU_API_SECRET": "your-api-secret",
        "SMOOBU_ALLOW_WRITES": "false"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add smoobu -- npx -y mcp-smoobu
```

Then set the environment variables:

```bash
export SMOOBU_API_KEY="your-api-key"
export SMOOBU_API_SECRET="your-api-secret"
# Safety default: write operations are blocked unless explicitly enabled.
export SMOOBU_ALLOW_WRITES="false"
```

## Authentication

Smoobu HMAC authentication is supported via:

- `SMOOBU_API_KEY` — API key
- `SMOOBU_API_SECRET` — API secret used to sign each request

If `SMOOBU_API_SECRET` is missing, the client falls back to the legacy `Api-Key` header for backward compatibility.

## Write Safety

Write operations are disabled by default to avoid accidental production changes. This includes creating/updating/cancelling reservations, sending guest messages, updating rates, guests, and price elements.

To enable writes intentionally, set:

```bash
SMOOBU_ALLOW_WRITES=true
```

Keep it unset or set to `false` for read-only usage.

## Tools

### Read Tools (16)

| Tool | Description |
|------|-------------|
| `get_user` | Get current user/account info |
| `list_apartments` | List all apartments |
| `get_apartment` | Get apartment details |
| `list_reservations` | List reservations with filters |
| `get_reservation` | Get reservation details |
| `get_reservation_price_elements` | Get price elements for a reservation |
| `get_reservation_placeholders` | Get placeholder values for a reservation |
| `list_guests` | List all guests |
| `get_guest` | Get guest details |
| `list_reservation_messages` | List messages for a reservation |
| `list_threads` | List message threads |
| `list_rates` | List rates for an apartment |
| `list_addons` | List available add-ons |
| `list_custom_placeholders` | List custom placeholders |
| `get_custom_placeholder` | Get a custom placeholder |
| `list_online_check_ins` | List online check-ins |

### Write Tools (11)

| Tool | Description |
|------|-------------|
| `check_apartment_availability` | Check apartment availability for dates |
| `send_reservation_message` | Send a message for a reservation |
| `create_guest` | Create a new guest |
| `update_guest` | Update guest details |
| `create_reservation` | Create a new reservation |
| `update_reservation` | Update a reservation |
| `cancel_reservation` | Cancel a reservation |
| `create_price_element` | Add a price element to a reservation |
| `update_price_element` | Update a price element |
| `delete_price_element` | Delete a price element |
| `update_rates` | Update rates for an apartment |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

## API Documentation

See the official [Smoobu API documentation](https://docs.smoobu.com/) for details on endpoints and data models.

## License

[MIT](LICENSE) © Morgan Demoulin
