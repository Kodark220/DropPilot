import 'dotenv/config';
import { createServer } from 'http';
import { LCDClient, MnemonicKey, MsgExecute, Wallet, bcs } from '@initia/initia.js';

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
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '15000');
const PORT = parseInt(process.env.PORT || process.env.AGENT_PORT || '3100');
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

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
    return JSON.parse(result.data);
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
async function scanDrops() {
  const userCount = registeredUsers.size;
  if (userCount === 0) return;
  console.log(`[Agent] Scanning drops... (${userCount} user${userCount !== 1 ? 's' : ''})`);

  const nextId = await getNextDropId();
  const now = Math.floor(Date.now() / 1000);

  for (let id = 1; id < nextId; id++) {
    const drop = await getDrop(id);
    if (!drop) continue;

    const startTime = Number(drop.start_time || drop.startTime || 0);
    const endTime = Number(drop.end_time || drop.endTime || 0);
    const sold = Number(drop.sold || 0);
    const totalSupply = Number(drop.total_supply || drop.totalSupply || 0);

    const isLive = drop.active && now >= startTime && now <= endTime;
    const hasSupply = sold < totalSupply;
    if (!isLive || !hasSupply) continue;

    // Process each registered user sequentially (to avoid sequence number conflicts)
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
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
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
        console.log(`[Agent] Registered user: ${address} watching drops: [${mergedDropIds}] (total: ${registeredUsers.size})`);
        return json(200, { ok: true, users: registeredUsers.size, watching: mergedDropIds });
      }

      // DELETE /register?address=init1... — frontend calls this on revoke
      if (req.method === 'DELETE' && req.url?.startsWith('/register')) {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const address = url.searchParams.get('address');
        if (address && registeredUsers.has(address)) {
          registeredUsers.delete(address);
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
