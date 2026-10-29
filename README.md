# GORZ Launch Intel MCP server

How Solana coins were launched, for AI assistants and trading agents.

Ask your assistant "who launched this coin?" and it checks the launch with [GORZ](https://gorz.app). It reports:

- **Team bundle:** what the creator's own team bought at launch: the wallets and their share of supply. Outside snipers are never counted.
- **Launch tool:** the tool used to launch the coin, once GORZ has identified it.
- **Launch team:** the team behind the coin, tracked across launches: how many coins they launched, from how many fresh wallets, and how many dumped.
- **Sandwich bots:** front-run, victim and back-run attacks on buyers. Sniper flips are counted separately, never as sandwiches.

GORZ reports what public on-chain data shows. Flags are patterns, not accusations, and nothing it returns is financial advice. For coin safety grades and red flags, see the sister server [gorz-mcp](https://github.com/GORZ-APP/gorz-mcp).

## Tools

| Tool | What it does | Key needed |
|---|---|---|
| `gorz_launch_dna` | How one coin was launched: what the creator's team bought, launch kit and tool, the team behind it with its dump rate, and sandwich bots. | No |
| `gorz_sandwiches` | Sandwich attacks on a coin. By wallet: is it a sandwich bot, and how often was it sandwiched. | Coin: no · wallet: yes |
| `gorz_launcher` | A launch team's full record, by operator id (`OP-xxxxxx`) or any of its wallets: coins launched, fresh dev wallets, bundle sizes, kits and tools, recent coins, dump rate. | Yes |
| `gorz_top_launchers` | The biggest repeat launch teams, optionally only those that bundle. | Yes |
| `gorz_launch_tools` | Every launch tool GORZ recognises, with how many launches used it and how many of their coins dumped. | Yes |

Launch data covers Pump.fun coins GORZ saw launch. Teams and tools are updated several times a day.

## Install

Requires Node.js 18 or newer.

### Claude Desktop, Cursor and other MCP clients

Add this to your MCP config (for Claude Desktop that's `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "gorz-launch-intel": {
      "command": "npx",
      "args": ["-y", "gorz-launch-intel"],
      "env": { "GORZ_API_KEY": "" }
    }
  }
}
```

Leave `GORZ_API_KEY` empty to use the free tier.

### Claude Code

```
claude mcp add gorz-launch-intel -- npx -y gorz-launch-intel
```

### Remote server (no install)

Clients that support remote MCP servers can connect to `https://gorz.app/mcp/launch` (Streamable HTTP). Add your key as an `Authorization: Bearer gorz_…` header, or as `?key=gorz_…` on the URL.

## Limits and keys

The same GORZ API keys work here and in gorz-mcp.

| Plan | Calls per day | Price |
|---|---|---|
| Free | 300, no key | $0 |
| Starter | 20,000, plus team, tool and wallet lookups | $49 / 30 days |
| Pro | 200,000 | $199 / 30 days |

Get a key at [gorz.app/developers](https://gorz.app/developers), paid in SOL or USDC.

## Terms

GORZ data is for your own use and your own users. It may not be resold, redistributed or used to build a competing dataset. GORZ reports patterns in public on-chain data; they are not accusations, and nothing here is financial advice.

## Settings

| Variable | Default | Purpose |
|---|---|---|
| `GORZ_API_KEY` | (empty) | Your GORZ key, for higher limits and team, tool and wallet lookups |
| `GORZ_API_URL` | `https://gorz.app/api/v1` | Only change this for testing |
