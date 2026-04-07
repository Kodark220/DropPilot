require('dotenv/config');
const { createServer } = require('http');
const fs = require('fs');
const path = require('path');
const { LCDClient, MnemonicKey, MsgExecute, Wallet, bcs } = require('@initia/initia.js');

/**
 * DropPilot Agent — watches for live drops and auto-purchases within budget.
 *
 * Flow:
 * 1. Users register via HTTP endpoint (called from frontend on authorize)
 * 2. Polls the onchain Registry for active drops
 * 3. For EACH registered user, checks if drop matches and budget allows
 * 4. Calls agent_purchase for every eligible user
 * 5. Also monitors secondary market for deals under max price
 */

const LCD_URL = process.env.LCD_ENDPOINT || 'https://rest.testnet.initia.xyz';
const MODULE = process.env.MODULE_ADDRESS;
const CHAIN_ID = process.env.CHAIN_ID || 'initiation-2';
const GAS_DENOM = process.env.GAS_DENOM || 'uinit';
const MNEMONIC = process.env.AGENT_MNEMONIC;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '3000');
const PORT = parseInt(process.env.PORT || process.env.AGENT_PORT || '3100');
const CORS_ORIGIN = (process.env.CORS_ORIGIN || '*').replace(/\/+$/, '');

// Allowed origins for CORS
const ALLOWED_ORIGINS = CORS_ORIGIN === '*'
  ? null // allow all
  : new Set(CORS_ORIGIN.split(',').map(o => o.trim().replace(/\/+$/, '')));

function getCorsOrigin(req) {
  if (!ALLOWED_ORIGINS) return '*';
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  // Always allow the first configured origin as default
  return CORS_ORIGIN.split(',')[0].trim();
}

// ==================== Wallet Setup ====================
const key = new MnemonicKey({ mnemonic: MNEMONIC });
const lcd = new LCDClient(LCD_URL, {
  chainId: CHAIN_ID,
  gasPrices: `0.015${GAS_DENOM}`,
  gasAdjustment: '2.0',
});
const agentWallet = new Wallet(lcd, key);
const AGENT_ADDRESS = key.accAddress;

// Derive module hex address for view queries
function bech32ToHex(addr) {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const data = addr.slice(5);
  const values = [];
  for (const c of data) values.push(CHARSET.indexOf(c));
  const data5 = values.slice(0, -6);
  let acc = 0, bits = 0;
  const raw = [];
  for (const v of data5) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) { bits -= 8; raw.push((acc >> bits) & 0xFF); }
  }
  return '0x' + raw.map(b => b.toString(16).padStart(2, '0')).join('');
}
const MODULE_HEX = bech32ToHex(MODULE);

// Track all users who have authorized this agent
// Map: userAddress -> { watchDropIds, maxPricePerItem, autoBuyEnabled }
const registeredUsers = new Map();
// Track which (user, dropId) combos we've already purchased to avoid duplicates
const purchasedSet = new Set();

// ==================== Persistent Storage ====================
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'registered_users.json');

function saveRegistrations() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const data = {};
    for (const [addr, prefs] of registeredUsers) {
      data[addr] = {
        ...prefs,
        maxPricePerItem: prefs.maxPricePerItem === Infinity ? null : prefs.maxPricePerItem,
      };
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[Agent] Failed to save registrations:', err.message);
  }
}

function loadRegistrations() {
  try {
    if (!fs.existsSync(USERS_FILE)) return;
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    for (const [addr, prefs] of Object.entries(data)) {
      registeredUsers.set(addr, {
        ...prefs,
        maxPricePerItem: prefs.maxPricePerItem ?? Infinity,
      });
    }
    console.log(`[Agent] Loaded ${registeredUsers.size} registered user(s) from disk`);
  } catch (err) {
    console.error('[Agent] Failed to load registrations:', err.message);
  }
}

loadRegistrations();

// ==================== View Queries (BCS-encoded) ====================
async function queryView(functionName, args = []) {
  const encodedArgs = args.map(a => {
    if (typeof a === 'number' || (typeof a === 'string' && /^\d+$/.test(a))) {
      return bcs.u64().serialize(Number(a)).toBase64();
    }
    if (typeof a === 'string' && a.startsWith('init1')) {
      return bcs.address().serialize(a).toBase64();
    }
    return bcs.string().serialize(String(a)).toBase64();
  });

  const res = await fetch(
    `${LCD_URL}/initia/move/v1/accounts/${MODULE_HEX}/modules/drops/view_functions/${functionName}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: encodedArgs }),
    }
  );

  if (!res.ok) throw new Error(`View ${functionName} failed: ${await res.text()}`);
  return res.json();
}

async function getNextDropId() {
  const result = await queryView('get_next_drop_id');
  return parseInt(JSON.parse(result.data));
}

async function getDrop(dropId) {
  try {
    const result = await queryView('get_drop', [String(dropId)]);
    return JSON.parse(result.data);
  } catch {
    return null;
  }
}

async function getUserOwned(user, dropId) {
  const result = await queryView('get_user_owned', [user, String(dropId)]);
  return parseInt(JSON.parse(result.data));
}

async function getAgentWalletOnChain(owner) {
  try {
    const result = await queryView('get_agent_wallet', [owner]);
    const raw = JSON.parse(result.data);
    // On-chain returns [agent_hex, budget_str, spent_str, active_bool]
    if (Array.isArray(raw)) {
      return { agent: raw[0], budget: raw[1], spent: raw[2], active: raw[3] };
    }
    return raw;
  } catch {
    return null;
  }
}

// ==================== Transaction Execution ====================
async function executeAgentPurchase(ownerAddr, dropId, quantity = 1) {
  const msg = new MsgExecute(
    AGENT_ADDRESS,
    MODULE,
    'drops',
    'agent_purchase',
    [],
    [
      bcs.address().serialize(ownerAddr).toBase64(),
      bcs.u64().serialize(dropId).toBase64(),
      bcs.u64().serialize(quantity).toBase64(),
    ]
  );

  console.log(`[Agent] Signing agent_purchase(owner=${ownerAddr.slice(0, 16)}..., drop=${dropId}, qty=${quantity})`);
  const signedTx = await agentWallet.createAndSignTx({ msgs: [msg] });
  const result = await lcd.tx.broadcastSync(signedTx);
  console.log(`[Agent] TX broadcast: ${result.txhash}`);
  return result;
}

// ==================== Scanning ====================
// Cache drops that are done (ended/cancelled/sold out) to avoid re-fetching
const skipDropIds = new Set();

async function scanDrops() {
  const userCount = registeredUsers.size;
  if (userCount === 0) return;

  const nextId = await getNextDropId();
  const now = Math.floor(Date.now() / 1000);

  // Fetch all non-skipped drops in parallel
  const idsToFetch = [];
  for (let id = 1; id < nextId; id++) {
    if (!skipDropIds.has(id)) idsToFetch.push(id);
  }

  const dropResults = await Promise.all(idsToFetch.map(async (id) => {
    const drop = await getDrop(id);
    return { id, drop };
  }));

  const liveDrops = [];
  for (const { id, drop } of dropResults) {
    if (!drop) { skipDropIds.add(id); continue; }

    const startTime = Number(drop.start_time || drop.startTime || 0);
    const endTime = Number(drop.end_time || drop.endTime || 0);
    const sold = Number(drop.sold || 0);
    const totalSupply = Number(drop.total_supply || drop.totalSupply || 0);

    // Permanently skip cancelled, ended, or sold-out drops
    if (!drop.active) { skipDropIds.add(id); continue; }
    if (now > endTime) { skipDropIds.add(id); continue; }
    if (sold >= totalSupply) { skipDropIds.add(id); continue; }

    const isLive = now >= startTime && now <= endTime;
    if (!isLive) continue; // upcoming — don't skip, check again next poll

    liveDrops.push({ id, drop });
  }

  if (liveDrops.length === 0) return;
  console.log(`[Agent] Found ${liveDrops.length} live drop(s), processing for ${userCount} user(s)`);

  // Process each live drop for each user (sequential to avoid sequence number conflicts)
  for (const { id, drop } of liveDrops) {
    for (const [userAddr, prefs] of registeredUsers) {
      await processDropForUser(id, drop, userAddr, prefs);
    }
  }
}

async function processDropForUser(dropId, drop, userAddr, prefs) {
  const purchaseKey = `${userAddr}:${dropId}`;
  if (purchasedSet.has(purchaseKey)) return;

  try {
    const withinBudget = Number(drop.price) <= (prefs.maxPricePerItem || Infinity);
    const isWatched = !prefs.watchDropIds?.length || prefs.watchDropIds.includes(dropId);
    if (!withinBudget || !isWatched || !prefs.autoBuyEnabled) return;

    // Verify on-chain that this user authorized THIS agent
    const onChainWallet = await getAgentWalletOnChain(userAddr);
    if (!onChainWallet || !onChainWallet.active) return;
    if (onChainWallet.agent !== AGENT_ADDRESS) {
      // Compare hex if needed
      const agentHex = bech32ToHex(AGENT_ADDRESS);
      const walletAgentHex = onChainWallet.agent?.startsWith('0x') ? onChainWallet.agent : bech32ToHex(onChainWallet.agent);
      if (agentHex !== walletAgentHex) return;
    }

    // Check budget
    const spent = Number(onChainWallet.spent || 0);
    const budget = Number(onChainWallet.budget || 0);
    if (spent + Number(drop.price) > budget) {
      console.log(`[Agent] Budget exceeded for ${userAddr.slice(0, 12)}... on drop #${dropId}`);
      return;
    }

    // Check purchase limit
    const maxPerUser = Number(drop.max_per_user || drop.maxPerUser || 1);
    const owned = await getUserOwned(userAddr, dropId);
    if (owned >= maxPerUser) {
      console.log(`[Agent] ${userAddr.slice(0, 12)}... at max for drop #${dropId}`);
      purchasedSet.add(purchaseKey);
      return;
    }

    console.log(`[Agent] Buying drop #${dropId} "${drop.name}" for ${userAddr.slice(0, 12)}...`);
    const result = await executeAgentPurchase(userAddr, dropId, 1);
    console.log(`[Agent] Purchase TX: ${result.txhash}`);
    purchasedSet.add(purchaseKey);
  } catch (err) {
    console.error(`[Agent] Error on drop #${dropId} for ${userAddr.slice(0, 12)}...:`, err.message);
  }
}

async function scanSecondaryMarket() {
  // Secondary market scanning placeholder
  if (registeredUsers.size === 0) return;
}

// ==================== Chat Handler ====================
async function handleChatMessage(message, userAddr) {
  const lower = message.toLowerCase().trim();

  try {
    // --- Status / Budget ---
    if (lower.match(/\b(status|budget|balance|wallet|how much|remaining)\b/)) {
      return await chatStatus(userAddr);
    }

    // --- List drops ---
    if (lower.match(/\b(drops|list|show|available|what.*(live|active|buy))\b/)) {
      return await chatListDrops();
    }

    // --- Watch / auto-buy a drop ---
    const watchMatch = lower.match(/\b(?:watch|auto.?buy|track|alert|notify)\b.*?#?(\d+)/);
    if (watchMatch) {
      return await chatWatch(userAddr, parseInt(watchMatch[1]));
    }
    // also handle "watch drop 2" without #
    const watchMatch2 = lower.match(/\b(?:watch|auto.?buy|track)\s+(?:drop\s+)?(\d+)/);
    if (watchMatch2) {
      return await chatWatch(userAddr, parseInt(watchMatch2[1]));
    }

    // --- Stop watching ---
    const unwatchMatch = lower.match(/\b(?:unwatch|stop|remove|cancel)\b.*?#?(\d+)/);
    if (unwatchMatch) {
      return await chatUnwatch(userAddr, parseInt(unwatchMatch[1]));
    }

    // --- Buy now (agent purchase) ---
    const buyMatch = lower.match(/\bbuy\b.*?#?(\d+)/);
    if (buyMatch) {
      return await chatBuy(userAddr, parseInt(buyMatch[1]));
    }

    // --- My watched drops ---
    if (lower.match(/\b(watching|my\s+drops|my\s+watch|tracked)\b/)) {
      return chatMyWatched(userAddr);
    }

    // --- Help ---
    if (lower.match(/\b(help|commands|what can you|menu)\b/)) {
      return chatHelp();
    }

    // --- Agent info ---
    if (lower.match(/\b(who are you|about|info|agent)\b/) && !lower.includes('buy')) {
      return `I'm the DropPilot agent (${AGENT_ADDRESS.slice(0, 12)}...). I auto-purchase drops on your behalf when they go live. I poll the chain every ${POLL_INTERVAL / 1000}s looking for live drops you're watching.`;
    }

    // --- Fallback ---
    return chatHelp();
  } catch (err) {
    console.error('[Chat] Error:', err.message);
    return `Something went wrong: ${err.message}`;
  }
}

async function chatStatus(userAddr) {
  // Agent wallet balance
  let agentBalance = '?';
  try {
    const balRes = await fetch(`${LCD_URL}/cosmos/bank/v1beta1/balances/${AGENT_ADDRESS}`);
    const balData = await balRes.json();
    const uinit = balData.balances?.find(b => b.denom === GAS_DENOM);
    agentBalance = uinit ? (Number(uinit.amount) / 1_000_000).toFixed(2) : '0';
  } catch {}

  let userInfo = '';
  if (userAddr) {
    const prefs = registeredUsers.get(userAddr);
    const onChain = await getAgentWalletOnChain(userAddr);

    if (onChain && onChain.active) {
      const budget = (Number(onChain.budget || 0) / 1_000_000).toFixed(2);
      const spent = (Number(onChain.spent || 0) / 1_000_000).toFixed(2);
      const remaining = (Number(onChain.budget || 0) - Number(onChain.spent || 0)) / 1_000_000;
      userInfo = `\n\nYour on-chain authorization:\n• Budget: ${budget} INIT\n• Spent: ${spent} INIT\n• Remaining: ${remaining.toFixed(2)} INIT\n• Status: Active ✓`;
    } else {
      userInfo = '\n\n⚠ You have NOT authorized me on-chain yet. Go to the Agent page and click "Authorize Agent" first.';
    }

    if (prefs) {
      const watching = prefs.watchDropIds?.length || 0;
      userInfo += `\n• Watching: ${watching} drop(s)`;
    } else {
      userInfo += '\n• Not registered with agent backend';
    }
  }

  return `Agent Wallet: ${agentBalance} INIT\nAgent Address: ${AGENT_ADDRESS.slice(0, 16)}...\nRegistered Users: ${registeredUsers.size}\nPolling: every ${POLL_INTERVAL / 1000}s${userInfo}`;
}

async function chatListDrops() {
  const nextId = await getNextDropId();
  if (nextId <= 1) return 'No drops found on-chain yet.';

  const now = Math.floor(Date.now() / 1000);
  const lines = [];

  for (let id = 1; id < nextId; id++) {
    const drop = await getDrop(id);
    if (!drop) continue;

    const start = Number(drop.start_time || drop.startTime || 0);
    const end = Number(drop.end_time || drop.endTime || 0);
    const sold = Number(drop.sold || 0);
    const total = Number(drop.total_supply || drop.totalSupply || 0);
    const price = (Number(drop.price || 0) / 1_000_000).toFixed(2);

    let status;
    if (!drop.active) status = '❌ Cancelled';
    else if (sold >= total) status = '🔴 Sold Out';
    else if (now < start) status = '🟡 Upcoming';
    else if (now > end) status = '⏰ Ended';
    else status = '🟢 LIVE';

    lines.push(`#${id} "${drop.name}" — ${price} INIT — ${sold}/${total} sold — ${status}`);
  }

  return lines.length ? `Drops on-chain:\n${lines.join('\n')}` : 'No drops found.';
}

async function chatWatch(userAddr, dropId) {
  if (!userAddr) return 'Connect your wallet first so I know your address.';

  const drop = await getDrop(dropId);
  if (!drop) return `Drop #${dropId} not found on-chain.`;

  // Check on-chain auth
  const onChain = await getAgentWalletOnChain(userAddr);
  if (!onChain || !onChain.active) {
    return `⚠ You need to authorize me on-chain first! Go to the Agent page → "Authorize Agent". Then come back and tell me to watch drop #${dropId}.`;
  }

  const existing = registeredUsers.get(userAddr) || { watchDropIds: [], autoBuyEnabled: true };
  const mergedDropIds = [...new Set([...(existing.watchDropIds || []), dropId])];
  registeredUsers.set(userAddr, { ...existing, watchDropIds: mergedDropIds, autoBuyEnabled: true });
  saveRegistrations();

  const price = (Number(drop.price || 0) / 1_000_000).toFixed(2);
  return `Now watching drop #${dropId} "${drop.name}" (${price} INIT). I'll auto-buy it for you when it goes live. You're watching ${mergedDropIds.length} drop(s) total.`;
}

async function chatUnwatch(userAddr, dropId) {
  if (!userAddr) return 'Connect your wallet first.';
  const prefs = registeredUsers.get(userAddr);
  if (!prefs) return "You're not registered. Nothing to unwatch.";

  prefs.watchDropIds = (prefs.watchDropIds || []).filter(id => id !== dropId);
  saveRegistrations();
  return `Removed drop #${dropId} from your watch list. Still watching ${prefs.watchDropIds.length} drop(s).`;
}

async function chatBuy(userAddr, dropId) {
  if (!userAddr) return 'Connect your wallet first.';

  const drop = await getDrop(dropId);
  if (!drop) return `Drop #${dropId} not found.`;

  const now = Math.floor(Date.now() / 1000);
  const start = Number(drop.start_time || drop.startTime || 0);
  const end = Number(drop.end_time || drop.endTime || 0);
  const sold = Number(drop.sold || 0);
  const total = Number(drop.total_supply || drop.totalSupply || 0);

  if (!drop.active) return `Drop #${dropId} is cancelled.`;
  if (sold >= total) return `Drop #${dropId} is sold out.`;
  if (now < start) return `Drop #${dropId} hasn't started yet. It starts at ${new Date(start * 1000).toLocaleString()}. I'll add it to your watch list instead.`;
  if (now > end) return `Drop #${dropId} has ended.`;

  // Check auth
  const onChain = await getAgentWalletOnChain(userAddr);
  if (!onChain || !onChain.active) {
    return '⚠ You need to authorize me on-chain first! Go to the Agent page → "Authorize Agent".';
  }

  // Check budget
  const spent = Number(onChain.spent || 0);
  const budget = Number(onChain.budget || 0);
  const price = Number(drop.price || 0);
  if (spent + price > budget) {
    return `Insufficient budget. You've spent ${(spent / 1e6).toFixed(2)} of ${(budget / 1e6).toFixed(2)} INIT. This drop costs ${(price / 1e6).toFixed(2)} INIT.`;
  }

  // Execute purchase
  const result = await executeAgentPurchase(userAddr, dropId, 1);
  purchasedSet.add(`${userAddr}:${dropId}`);
  return `Purchased drop #${dropId} "${drop.name}" for you! TX: ${result.txhash}`;
}

function chatMyWatched(userAddr) {
  if (!userAddr) return 'Connect your wallet first.';
  const prefs = registeredUsers.get(userAddr);
  if (!prefs || !prefs.watchDropIds?.length) return "You're not watching any drops right now.";
  const ids = prefs.watchDropIds.map(id => `#${id}`).join(', ');
  return `You're watching drops: ${ids}\nAuto-buy is ${prefs.autoBuyEnabled ? 'enabled ✓' : 'disabled ✗'}`;
}

function chatHelp() {
  return `Here's what I can do:\n\n• "status" — check agent wallet balance & your authorization\n• "drops" — list all drops on-chain with status\n• "watch #3" — auto-buy drop #3 when it goes live\n• "unwatch #3" — stop watching drop #3\n• "buy #3" — purchase drop #3 right now\n• "watching" — see your watched drops\n• "help" — show this menu`;
}

// --- HTTP API for frontend to register/unregister users ---
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

function startAPI() {
  const server = createServer(async (req, res) => {
    const origin = getCorsOrigin(req);
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const json = (code, data) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      // GET /health — Render health check
      if (req.method === 'GET' && req.url === '/health') {
        return json(200, { status: 'ok' });
      }

      // GET /agent-address — returns the agent's signing address
      if (req.method === 'GET' && req.url === '/agent-address') {
        return json(200, { address: AGENT_ADDRESS });
      }

      // POST /register — frontend calls this after user authorizes agent on-chain
      if (req.method === 'POST' && req.url === '/register') {
        const { address, watchDropIds, maxPricePerItem, autoBuyEnabled } = await parseBody(req);
        if (!address || typeof address !== 'string' || !address.startsWith('init1')) {
          return json(400, { error: 'Invalid address' });
        }
        // Merge with existing prefs if user already registered
        const existing = registeredUsers.get(address) || { watchDropIds: [], autoBuyEnabled: true };
        const mergedDropIds = [...new Set([...(existing.watchDropIds || []), ...(watchDropIds || [])])];
        registeredUsers.set(address, {
          watchDropIds: mergedDropIds,
          maxPricePerItem: maxPricePerItem || existing.maxPricePerItem || Infinity,
          autoBuyEnabled: autoBuyEnabled !== false,
        });
        saveRegistrations();
        console.log(`[Agent] Registered user: ${address} watching drops: [${mergedDropIds}] (total: ${registeredUsers.size})`);
        return json(200, { ok: true, users: registeredUsers.size, watching: mergedDropIds });
      }

      // DELETE /register?address=init1... — frontend calls this on revoke
      if (req.method === 'DELETE' && req.url?.startsWith('/register')) {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const address = url.searchParams.get('address');
        if (address && registeredUsers.has(address)) {
          registeredUsers.delete(address);
          saveRegistrations();
          console.log(`[Agent] Unregistered user: ${address} (total: ${registeredUsers.size})`);
        }
        return json(200, { ok: true, users: registeredUsers.size });
      }

      // GET /status — check agent health, address, and registered user count
      if (req.method === 'GET' && req.url === '/status') {
        return json(200, {
          running: true,
          agentAddress: AGENT_ADDRESS,
          users: registeredUsers.size,
          userList: [...registeredUsers.keys()],
          module: MODULE,
          chain: CHAIN_ID,
        });
      }

      // GET /registered?address=init1... — get a user's watched drops
      if (req.method === 'GET' && req.url?.startsWith('/registered')) {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const address = url.searchParams.get('address');
        if (!address) return json(400, { error: 'Missing address param' });
        const prefs = registeredUsers.get(address);
        if (!prefs) return json(200, { registered: false, watchDropIds: [], autoBuyEnabled: false });
        return json(200, {
          registered: true,
          watchDropIds: prefs.watchDropIds || [],
          maxPricePerItem: prefs.maxPricePerItem === Infinity ? null : prefs.maxPricePerItem,
          autoBuyEnabled: prefs.autoBuyEnabled,
        });
      }

      // DELETE /watch?address=init1...&dropId=1 — remove a single drop from watch list
      if (req.method === 'DELETE' && req.url?.startsWith('/watch')) {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const address = url.searchParams.get('address');
        const dropId = parseInt(url.searchParams.get('dropId'));
        if (!address || isNaN(dropId)) return json(400, { error: 'Missing address or dropId' });
        const prefs = registeredUsers.get(address);
        if (prefs) {
          prefs.watchDropIds = (prefs.watchDropIds || []).filter(id => id !== dropId);
          saveRegistrations();
          console.log(`[Agent] ${address.slice(0, 12)}... removed drop #${dropId} from watch list`);
        }
        return json(200, { ok: true, watchDropIds: prefs?.watchDropIds || [] });
      }

      // POST /chat — interactive agent chat
      if (req.method === 'POST' && req.url === '/chat') {
        const { message, address: userAddr } = await parseBody(req);
        if (!message) return json(400, { error: 'Missing message' });
        const reply = await handleChatMessage(message, userAddr);
        return json(200, { reply });
      }

      json(404, { error: 'Not found' });
    } catch (err) {
      json(400, { error: err.message });
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Agent] API running on port ${PORT}`);
    console.log(`[Agent] Endpoints: GET /health, GET /agent-address, POST /register, DELETE /register, GET /status\n`);
  });
}

async function mainLoop() {
  console.log('=== DropPilot Agent Started ===');
  console.log(`LCD:     ${LCD_URL}`);
  console.log(`Module:  ${MODULE}`);
  console.log(`Agent:   ${AGENT_ADDRESS}`);
  console.log(`Chain:   ${CHAIN_ID}`);
  console.log(`Port:    ${PORT}`);
  console.log(`CORS:    ${CORS_ORIGIN}`);
  console.log(`Poll:    ${POLL_INTERVAL}ms`);
  console.log('================================\n');

  if (!MODULE) {
    console.error('[Agent] MODULE_ADDRESS not set. Deploy your contract first, then set it in .env');
    process.exit(1);
  }
  if (!MNEMONIC) {
    console.error('[Agent] AGENT_MNEMONIC not set. Set the mnemonic for the agent wallet.');
    process.exit(1);
  }

  startAPI();

  while (true) {
    try {
      await scanDrops();
      await scanSecondaryMarket();
    } catch (err) {
      console.error('[Agent] Poll error:', err.message);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

mainLoop();
