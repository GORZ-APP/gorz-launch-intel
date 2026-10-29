#!/usr/bin/env node
// GORZ Launch Intel MCP server: how Solana (Pump.fun) coins were launched, for AI assistants and trading agents.
// Tools: gorz_launch_dna, gorz_sandwiches (free tier) and gorz_launcher, gorz_launch_tools, gorz_top_launchers (need a key).
// Talks to the public GORZ API v1 over HTTPS. Sister server to gorz-mcp (coin safety checks); same API keys.
// Optional env: GORZ_API_KEY (higher limits + team, tool and wallet lookups; https://gorz.app/developers),
//               GORZ_API_URL (default https://gorz.app/api/v1).
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';

const VERSION = '0.1.0';
const BASE = (process.env.GORZ_API_URL || 'https://gorz.app/api/v1').replace(/\/+$/, '');
const KEY = (process.env.GORZ_API_KEY || '').trim();
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const NEEDS_KEY = 'This needs a GORZ API key. Set GORZ_API_KEY in this server\'s settings. Keys: https://gorz.app/developers';

async function call(path, params) {
  const url = BASE + path + '?' + new URLSearchParams(params).toString();
  const headers = {'user-agent': 'gorz-launch-intel/' + VERSION, accept: 'application/json'};
  if (KEY) headers['x-api-key'] = KEY;
  let r;
  try { r = await fetch(url, {headers, signal: AbortSignal.timeout(15000)}); }
  catch (e) { return {ok: false, status: 0, body: {error: 'Could not reach GORZ (' + (e?.name === 'TimeoutError' ? 'timed out' : e?.message || 'network error') + '). Try again shortly.'}}; }
  const body = await r.json().catch(() => ({error: 'GORZ sent an unreadable reply (HTTP ' + r.status + ').'}));
  return {ok: r.ok, status: r.status, body, left: r.headers.get('x-ratelimit-remaining')};
}

const text = (s) => ({content: [{type: 'text', text: s}]});
const fail = (s) => ({content: [{type: 'text', text: s}], isError: true});
const sol = (lamports) => (Number(lamports || 0) / 1e9).toFixed(3) + ' SOL';
const day = (t) => (t ? new Date(t).toISOString().slice(0, 10) : '?');
const left = (res) => (res.left != null ? `\n(GORZ calls left today: ${res.left})` : '');
function limitNote(res) {
  if (res.status === 429) return '\n\nDaily limit reached. ' + (KEY ? 'Your plan limit resets at 00:00 UTC.' : 'The free tier is 300 calls a day. A key raises it: https://gorz.app/developers');
  if (res.status === 402) return '\n\nThis GORZ key has expired. Renew it at https://gorz.app/developers';
  if (res.status === 401) return '\n\n' + (KEY ? 'The GORZ_API_KEY was not accepted.' : NEEDS_KEY);
  if (res.status === 503) return '\n\nGORZ launch data is briefly offline. Try again in a few minutes.';
  return '';
}
const errorOf = (res) => fail((res.body?.error || `GORZ returned HTTP ${res.status}.`) + limitNote(res));

const server = new McpServer({name: 'gorz-launch-intel', version: VERSION});

server.registerTool('gorz_launch_dna', {
  title: 'How a Solana coin was launched (GORZ Launch DNA)',
  description: 'Launch DNA for a Pump.fun coin by contract address: the wallets the creator\'s own team bought with at launch and their share of supply (outside snipers never counted), the launch kit and launch tool behind it, the operator (team) with how many coins they launched and how many dumped, and sandwich bots seen on it. Covers coins GORZ saw launch.',
  inputSchema: {mint: z.string().describe('Solana token mint (contract) address')},
  annotations: {readOnlyHint: true, openWorldHint: true},
}, async ({mint}) => {
  mint = String(mint || '').trim();
  if (!ADDRESS.test(mint)) return fail('That is not a Solana address.');
  const res = await call('/launch', {mint});
  if (res.status === 404) return text(res.body?.error || `GORZ has no launch record for ${mint}.`);
  if (!res.ok) return errorOf(res);
  const b = res.body, tb = b.teamBundle || {}, out = [`Launch DNA for ${mint}`];
  out.push(tb.txs ? `Team bundle: the creator's own team bought ${tb.supplyPct}% of supply at launch with ${tb.wallets} wallet${tb.wallets === 1 ? '' : 's'}.` : 'Team bundle: none seen at launch.');
  if (b.kit) out.push(`Launch kit: ${b.kit}${b.kitFlagged && b.kitDumpPct != null ? ` (flagged: ${b.kitDumpPct}% of its ${b.kitLaunches ?? 'many'} coins dumped)` : ''}.`);
  out.push(b.tool ? `Launch tool: ${b.tool.name || b.tool.id}.` : 'Launch tool: not identified.');
  out.push(b.operator ? `Operator: ${b.operator.id}, ${b.operator.launches ?? '?'} coins launched${b.operator.dumpPct != null ? `, ${b.operator.dumpPct}% of the graded ones dumped` : ''}. Use gorz_launcher for the full profile.` : 'Operator: not linked to a repeat launcher.');
  if (b.knownSnipers) out.push(`Known sniper bots in the first 2 blocks: ${b.knownSnipers}.`);
  if (b.sandwiches?.count) out.push(`Sandwich bots: ${b.sandwiches.count} sandwich${b.sandwiches.count === 1 ? '' : 'es'}, about ${b.sandwiches.victimLossSol} SOL taken from buyers.`);
  if (b.proxima) out.push(`Proxima bundle tool: ${b.proxima.txs} transactions, ${b.proxima.fleetWallets} fleet wallets.`);
  out.push(`\n${b.disclaimer || 'Not financial advice.'}`);
  return text(out.join('\n') + left(res));
});

server.registerTool('gorz_launcher', {
  title: 'Profile a coin launch team (GORZ operator)',
  description: 'Everything GORZ has linked to one launch team: pass an operator id (OP-xxxxxx, from gorz_launch_dna) or any wallet. Returns how many coins they launched, from how many fresh creator wallets, how often they bundled and with what share of supply, the kits and tools they use, recent coins and their dump rate. Needs a GORZ API key.',
  inputSchema: {id: z.string().optional().describe('Operator id like OP-1EE1A6'), wallet: z.string().optional().describe('Or any Solana wallet')},
  annotations: {readOnlyHint: true, openWorldHint: true},
}, async ({id, wallet}) => {
  id = String(id || '').trim().toUpperCase(); wallet = String(wallet || '').trim();
  if (!/^OP-[0-9A-F]{6}$/.test(id) && !ADDRESS.test(wallet)) return fail('Pass an operator id like OP-1EE1A6 or a Solana wallet.');
  if (!KEY) return fail(NEEDS_KEY);
  const res = await call('/launcher', id ? {id} : {wallet});
  if (res.status === 404) return text(res.body?.note || 'GORZ has not linked that to a launch team.');
  if (!res.ok) return errorOf(res);
  const o = res.body.operator;
  return text([`Operator ${o.id}: ${o.launches} coins launched from ${o.creators} creator wallet${o.creators === 1 ? '' : 's'} (${o.walletCount} wallets linked), ${day(o.firstAt)} to ${day(o.lastAt)}.`,
    `Team-bundled ${o.bundledLaunches} of them, average ${o.avgBundlePct}% of supply in the launch bundle.`,
    o.dumpPct != null ? `${o.dumpPct}% of ${o.graded} graded coins dumped (all coins: ${res.body.baselineDumpPct ?? '?'}%).` : 'Not enough graded coins for a dump rate yet.',
    `Kits: ${(o.kits || []).map((k) => `${k.id} (${k.count})`).join(', ') || 'none'}. Tools: ${(o.tools || []).map((t) => `${t.name || t.id} (${t.count})`).join(', ') || 'none identified'}.`,
    `Recent coins: ${(o.recentMints || []).slice(0, 5).join(', ')}`, `\n${res.body.disclaimer || 'Not financial advice.'}`].join('\n'));
});

server.registerTool('gorz_top_launchers', {
  title: 'Biggest repeat launch teams on Solana',
  description: 'The launch teams (operators) GORZ has linked across many launches: coins launched, fresh creator wallets used, team bundles and their size, dump rate. Optionally only teams that bundled at least N launches. Needs a GORZ API key.',
  inputSchema: {minBundled: z.number().optional().describe('Only teams that team-bundled at least this many launches (default 0)'), limit: z.number().optional().describe('How many teams, 1-50 (default 20)')},
  annotations: {readOnlyHint: true, openWorldHint: true},
}, async ({minBundled, limit}) => {
  if (!KEY) return fail(NEEDS_KEY);
  const res = await call('/launchers', {limit: String(Math.max(1, Math.min(50, Number(limit) || 20))), minBundled: String(Math.max(0, Number(minBundled) || 0))});
  if (!res.ok) return errorOf(res);
  const b = res.body, out = [`Repeat launch teams (last ${b.windowDays} days; ${b.baselineDumpPct ?? '?'}% of all graded coins dumped):`];
  for (const o of b.operators || []) out.push(`- ${o.id}: ${o.launches} coins from ${o.creators} creator wallet${o.creators === 1 ? '' : 's'}, team-bundled ${o.bundledLaunches} (avg ${o.avgBundlePct}% of supply)${o.dumpPct != null ? `, ${o.dumpPct}% dumped` : ''}`);
  out.push(`\n${b.disclaimer || 'Not financial advice.'}`);
  return text(out.join('\n'));
});

server.registerTool('gorz_launch_tools', {
  title: 'Solana launch tools GORZ has identified',
  description: 'The launch tools GORZ recognises on Pump.fun: id, name when confirmed, how many launches and creators used each, and how many of their coins dumped. Needs a GORZ API key.',
  inputSchema: {},
  annotations: {readOnlyHint: true, openWorldHint: true},
}, async () => {
  if (!KEY) return fail(NEEDS_KEY);
  const res = await call('/tools', {});
  if (!res.ok) return errorOf(res);
  const b = res.body, out = [`${(b.tools || []).length} launch tools seen in the last ${b.windowDays} days (${Number(b.launchesSeen || 0).toLocaleString('en-US')} launches; ${b.baselineDumpPct ?? '?'}% of all graded coins dumped):`];
  for (const t of (b.tools || []).slice(0, 25)) out.push(`- ${t.name || t.id}${t.name ? ` (${t.id})` : ''}: ${t.launches} launches by ${t.creators} creators${t.dumpPct != null ? `, ${t.dumpPct}% dumped` : ''}`);
  out.push(`\n${b.disclaimer || 'Not financial advice.'}`);
  return text(out.join('\n'));
});

server.registerTool('gorz_sandwiches', {
  title: 'Sandwich attacks on a Solana coin or wallet',
  description: 'Sandwich attacks (front-run, victims, back-run) on Pump.fun and PumpSwap, found in on-chain trades. Pass a coin to see every sandwich on it, or a wallet (needs GORZ_API_KEY) to see whether it is a sandwich bot and how often it was sandwiched. Same-block sniper flips are counted separately, never as sandwiches.',
  inputSchema: {mint: z.string().optional().describe('Solana token mint (contract) address'), wallet: z.string().optional().describe('Or a Solana wallet (needs a key)')},
  annotations: {readOnlyHint: true, openWorldHint: true},
}, async ({mint, wallet}) => {
  mint = String(mint || '').trim(); wallet = String(wallet || '').trim();
  if (!ADDRESS.test(mint) && !ADDRESS.test(wallet)) return fail('Pass a coin (mint) or a wallet address.');
  if (!ADDRESS.test(mint) && !KEY) return fail(NEEDS_KEY);
  const res = await call('/sandwiches', ADDRESS.test(mint) ? {mint} : {wallet});
  if (!res.ok) return errorOf(res);
  const b = res.body, out = [];
  if (b.mint) {
    out.push(`Sandwiches on ${b.mint} (last ${b.windowDays} days): ${b.sandwiches} sandwich${b.sandwiches === 1 ? '' : 'es'} on ${b.victims} buyer${b.victims === 1 ? '' : 's'}, about ${b.victimLossSol} SOL taken; ${b.blockFlips} same-block sniper flips.`);
    for (const e of (b.events || []).filter((e) => e.kind === 'sandwich').slice(0, 5)) out.push(`- ${new Date(e.at).toISOString().slice(0, 16).replace('T', ' ')} attacker ${e.attacker} took ${sol(e.profitLamports)} from ${e.victims.length} buyer${e.victims.length === 1 ? '' : 's'} (front ${e.frontSig}, back ${e.backSig})`);
  } else {
    const A = b.asAttacker, V = b.asVictim;
    out.push(`Wallet ${b.wallet}`);
    out.push(A ? `Sandwich bot: ${A.sandwiches} sandwiches on ${A.victims} buyers, took ${A.takenSol} SOL from them; also ${A.blockFlips} same-block flips. First seen ${day(A.firstAt)}, last ${day(A.lastAt)}.` : 'Not seen sandwiching anyone.');
    out.push(V ? `Sandwiched ${V.timesSandwiched} time${V.timesSandwiched === 1 ? '' : 's'} in ${b.windowDays} days, lost about ${V.estLossSol} SOL.` : `Not sandwiched in the last ${b.windowDays} days.`);
  }
  out.push(`\n${b.disclaimer || 'Not financial advice.'}`);
  return text(out.join('\n') + left(res));
});

await server.connect(new StdioServerTransport());
