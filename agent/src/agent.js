import 'dotenv/config';
import { createServer } from 'http';

/**
 * DropPilot Agent — watches for live drops and auto-purchases within budget.
 *
 * Flow:
 * 1. Users register via HTTP endpoint (called from frontend on authorize)
 * 2. Polls the onchain Registry for active drops
 * 3. For EACH registered user, checks if drop matches and budget allows
 * 4. Calls agent_purchase for every eligible user in parallel
 * 5. Also monitors secondary market for deals under max price
 */

const LCD = process.env.LCD_ENDPOINT || 'https://rest.testnet.initia.xyz';
const MODULE = process.env.MODULE_ADDRESS;
const CHAIN_ID = process.env.CHAIN_ID || 'initiation-2';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '5000');
const PORT = parseInt(process.env.PORT || process.env.AGENT_PORT || '3100');
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Track all users who have authorized this agent
// Map: userAddress -> { watchDropIds, maxPricePerItem, autoBuyEnabled }
const registeredUsers = new Map();

async function queryView(functionName, args = []) {
  const body = {
    address: MODULE,
    module_name: 'drops',
    function_name: functionName,
    type_args: [],
    args: args.map(String),
  };

  const res = await fetch(`${LCD}/initia/move/v1/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`View query failed: ${text}`);
  }

  return res.json();
}

async function getNextDropId() {
  const result = await queryView('get_next_drop_id');
  return parseInt(result.data);
}

async function getDrop(dropId) {
  try {
    const result = await queryView('get_drop', [dropId]);
    return result.data;
  } catch {
    return null;
  }
}

async function getUserOwned(user, dropId) {
  const result = await queryView('get_user_owned', [user, dropId]);
  return parseInt(result.data);
}

async function getAgentWallet(owner) {
  try {
    const result = await queryView('get_agent_wallet', [owner]);
    return result.data;
  } catch {
    return null;
  }
}

async function scanDrops() {
  const userCount = registeredUsers.size;
  console.log(`[Agent] Scanning for active drops... (${userCount} registered user${userCount !== 1 ? 's' : ''})`);

  if (userCount === 0) return;

  const nextId = await getNextDropId();
  const now = Math.floor(Date.now() / 1000);

  for (let id = 1; id < nextId; id++) {
    const drop = await getDrop(id);
    if (!drop) continue;

    const isLive = drop.active && now >= drop.start_time && now <= drop.end_time;
    const hasSupply = drop.sold < drop.total_supply;
    if (!isLive || !hasSupply) continue;

    // Check this drop for EVERY registered user in parallel
    const tasks = [];
    for (const [userAddr, prefs] of registeredUsers) {
      tasks.push(processDropForUser(id, drop, userAddr, prefs));
    }
    await Promise.all(tasks);
  }
}

async function processDropForUser(dropId, drop, userAddr, prefs) {
  try {
    const withinBudget = drop.price <= (prefs.maxPricePerItem || Infinity);
    const isWatched = !prefs.watchDropIds?.length || prefs.watchDropIds.includes(dropId);
    if (!withinBudget || !isWatched || !prefs.autoBuyEnabled) return;

    // Verify on-chain that this user still has us authorized
    const wallet = await getAgentWallet(userAddr);
    if (!wallet) return;

    // Check purchase limit
    const owned = await getUserOwned(userAddr, dropId);
    if (owned >= drop.max_per_user) {
      console.log(`[Agent] User ${userAddr.slice(0, 12)}... already at max for drop #${dropId}. Skipping.`);
      return;
    }

    console.log(`[Agent] Drop #${dropId} "${drop.name}" — buying for ${userAddr.slice(0, 12)}...`);
    console.log(`[Agent] >> Would execute agent_purchase(owner=${userAddr}, drop_id=${dropId}, qty=1)`);
    // TODO: wire up initia.js MsgExecute to submit the tx
  } catch (err) {
    console.error(`[Agent] Error processing drop #${dropId} for ${userAddr.slice(0, 12)}...:`, err.message);
  }
}

async function scanSecondaryMarket() {
  if (registeredUsers.size === 0) return;
  console.log('[Agent] Scanning secondary market...');
  console.log('[Agent] >> Secondary market scan (wire up listing iteration)');
}

// --- HTTP API for frontend to register/unregister users ---
function startAPI() {
  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // GET /health — Render health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // POST /register — frontend calls this after user authorizes agent on-chain
    if (req.method === 'POST' && req.url === '/register') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const { address, watchDropIds, maxPricePerItem, autoBuyEnabled } = JSON.parse(body);
          if (!address || typeof address !== 'string' || !address.startsWith('init1')) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid address' }));
            return;
          }
          registeredUsers.set(address, {
            watchDropIds: watchDropIds || [],
            maxPricePerItem: maxPricePerItem || Infinity,
            autoBuyEnabled: autoBuyEnabled !== false,
          });
          console.log(`[Agent] Registered user: ${address} (total: ${registeredUsers.size})`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, users: registeredUsers.size }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // DELETE /register?address=init1... — frontend calls this on revoke
    if (req.method === 'DELETE' && req.url?.startsWith('/register')) {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const address = url.searchParams.get('address');
      if (address && registeredUsers.has(address)) {
        registeredUsers.delete(address);
        console.log(`[Agent] Unregistered user: ${address} (total: ${registeredUsers.size})`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, users: registeredUsers.size }));
      return;
    }

    // GET /status — check agent health and registered user count
    if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        running: true,
        users: registeredUsers.size,
        userList: [...registeredUsers.keys()],
        module: MODULE,
        chain: CHAIN_ID,
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Agent] API running on port ${PORT}`);
    console.log(`[Agent] Endpoints: GET /health, POST /register, DELETE /register, GET /status\n`);
  });
}

async function mainLoop() {
  console.log('=== DropPilot Agent Started ===');
  console.log(`LCD: ${LCD}`);
  console.log(`Module: ${MODULE}`);
  console.log(`Chain: ${CHAIN_ID}`);
  console.log(`Port: ${PORT}`);
  console.log(`CORS: ${CORS_ORIGIN}`);
  console.log(`Poll interval: ${POLL_INTERVAL}ms`);
  console.log('================================\n');

  if (!MODULE) {
    console.error('[Agent] MODULE_ADDRESS not set. Deploy your contract first, then set it in .env');
    process.exit(1);
  }

  startAPI();

  while (true) {
    try {
      await scanDrops();
      await scanSecondaryMarket();
    } catch (err) {
      console.error('[Agent] Error:', err.message);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

mainLoop();
