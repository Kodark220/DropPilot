import { useInterwovenKit } from '@initia/interwovenkit-react';
import { MODULE_ADDRESS, GAS_DENOM, LCD_ENDPOINT } from '../main';

// ==================== BCS Encoding Helpers ====================
// MsgExecute requires BCS-encoded byte arrays for each argument.

function bcsEncodeU64(value) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  // Little-endian u64
  view.setUint32(0, Number(BigInt(value) & 0xFFFFFFFFn), true);
  view.setUint32(4, Number((BigInt(value) >> 32n) & 0xFFFFFFFFn), true);
  return new Uint8Array(buf);
}

function bcsEncodeString(str) {
  const encoded = new TextEncoder().encode(str);
  const lenBytes = bcsEncodeULEB128(encoded.length);
  const result = new Uint8Array(lenBytes.length + encoded.length);
  result.set(lenBytes);
  result.set(encoded, lenBytes.length);
  return result;
}

function bcsEncodeULEB128(value) {
  const bytes = [];
  do {
    let byte = value & 0x7F;
    value >>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return new Uint8Array(bytes);
}

function bcsEncodeAddress(addrStr) {
  // Handle hex addresses (0x-prefixed, 20 or 32 bytes)
  if (addrStr.startsWith('0x') || addrStr.startsWith('0X')) {
    const hex = addrStr.slice(2);
    const raw = new Uint8Array(hex.length / 2);
    for (let i = 0; i < raw.length; i++) {
      raw[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    // Pad to 32 bytes if shorter
    if (raw.length < 32) {
      const padded = new Uint8Array(32);
      padded.set(raw, 32 - raw.length);
      return padded;
    }
    return raw;
  }
  // Handle bech32 addresses (init1...)
  if (addrStr.startsWith('init1')) {
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const dataPart = addrStr.slice(5); // after "init1"
    const values = [];
    for (const c of dataPart) values.push(CHARSET.indexOf(c));
    // Remove checksum (last 6 values)
    const data5 = values.slice(0, -6);
    // Convert 5-bit to 8-bit
    let acc = 0, bits = 0;
    const raw = [];
    for (const v of data5) {
      acc = (acc << 5) | v;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        raw.push((acc >> bits) & 0xFF);
      }
    }
    // Pad to 32 bytes (Move address is 32 bytes)
    const padded = new Uint8Array(32);
    padded.set(raw, 32 - raw.length);
    return padded;
  }
  throw new Error(`Unsupported address format: ${addrStr}`);
}

function uint8ArrayToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ==================== Hook ====================

/**
 * Hook that provides helpers for interacting with the DropPilot Move module.
 * Uses InterwovenKit's requestTxBlock for signing + broadcasting.
 */
export function useDropsContract() {
  const { address, requestTxBlock } = useInterwovenKit();

  // Build a MsgExecute with BCS-encoded args
  function buildMoveExecuteMsg(fnName, typeArgs = [], bcsArgs = []) {
    if (!address) throw new Error('Wallet not connected');
    return {
      typeUrl: '/initia.move.v1.MsgExecute',
      value: {
        sender: address,
        moduleAddress: MODULE_ADDRESS,
        moduleName: 'drops',
        functionName: fnName,
        typeArgs: typeArgs,
        args: bcsArgs, // Uint8Array[] — proto repeated bytes field
      },
    };
  }

  // Query a view function via the accounts-based endpoint
  // Args should be base64-encoded BCS values. For convenience, pass raw JS values
  // and specify their types in argTypes (default: 'u64' for numbers, 'string' otherwise).
  async function queryView(functionName, args = []) {
    const moduleHex = '0x65fa458fcac34f0cc6269ff3ce9f6771a7846db2';
    const encodedArgs = args.map((a) => {
      if (typeof a === 'number' || (typeof a === 'string' && /^\d+$/.test(a))) {
        return uint8ArrayToBase64(bcsEncodeU64(Number(a)));
      }
      if (typeof a === 'string' && (a.startsWith('init1') || a.startsWith('0x'))) {
        return uint8ArrayToBase64(bcsEncodeAddress(a));
      }
      return uint8ArrayToBase64(bcsEncodeString(String(a)));
    });
    const body = { args: encodedArgs };

    const res = await fetch(
      `${LCD_ENDPOINT}/initia/move/v1/accounts/${moduleHex}/modules/drops/view_functions/${functionName}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) throw new Error(`View query failed: ${await res.text()}`);
    return res.json();
  }

  // ==================== Drop Actions ====================

  async function createDrop({ name, description, price, paymentDenom, totalSupply, maxPerUser, startTime, endTime }) {
    const metadataAddr = await getMetadataAddress(paymentDenom);
    const msg = buildMoveExecuteMsg('create_drop', [], [
      bcsEncodeString(name),
      bcsEncodeString(description),
      bcsEncodeU64(price),
      bcsEncodeAddress(metadataAddr),
      bcsEncodeU64(totalSupply),
      bcsEncodeU64(maxPerUser),
      bcsEncodeU64(startTime),
      bcsEncodeU64(endTime),
    ]);
    return requestTxBlock({ messages: [msg] });
  }

  async function purchase(dropId, quantity) {
    const msg = buildMoveExecuteMsg('purchase', [], [
      bcsEncodeU64(dropId),
      bcsEncodeU64(quantity),
    ]);
    return requestTxBlock({ messages: [msg] });
  }

  async function authorizeAgent(agentAddress, budget) {
    const msg = buildMoveExecuteMsg('authorize_agent', [], [
      bcsEncodeAddress(agentAddress),
      bcsEncodeU64(budget),
    ]);
    return requestTxBlock({ messages: [msg] });
  }

  async function revokeAgent() {
    const msg = buildMoveExecuteMsg('revoke_agent', [], []);
    return requestTxBlock({ messages: [msg] });
  }

  // Send tokens from connected wallet to a target address (e.g. agent wallet)
  async function fundAgent(amount, targetAddress) {
    const msg = {
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: {
        fromAddress: address,
        toAddress: targetAddress || MODULE_ADDRESS,
        amount: [{ denom: GAS_DENOM, amount: String(amount) }],
      },
    };
    return requestTxBlock({ messages: [msg] });
  }

  async function createListing(dropId, quantity, pricePerUnit, paymentDenom) {
    const metadataAddr = await getMetadataAddress(paymentDenom);
    const msg = buildMoveExecuteMsg('create_listing', [], [
      bcsEncodeU64(dropId),
      bcsEncodeU64(quantity),
      bcsEncodeU64(pricePerUnit),
      bcsEncodeAddress(metadataAddr),
    ]);
    return requestTxBlock({ messages: [msg] });
  }

  async function buyListing(listingId) {
    const msg = buildMoveExecuteMsg('buy_listing', [], [bcsEncodeU64(listingId)]);
    return requestTxBlock({ messages: [msg] });
  }

  async function cancelListing(listingId) {
    const msg = buildMoveExecuteMsg('cancel_listing', [], [bcsEncodeU64(listingId)]);
    return requestTxBlock({ messages: [msg] });
  }

  // ==================== View Queries ====================

  async function getDrop(dropId) {
    return queryView('get_drop', [String(dropId)]);
  }

  async function getListing(listingId) {
    return queryView('get_listing', [String(listingId)]);
  }

  async function getUserOwned(userAddr, dropId) {
    return queryView('get_user_owned', [userAddr, String(dropId)]);
  }

  async function getAgentWallet(ownerAddr) {
    return queryView('get_agent_wallet', [ownerAddr]);
  }

  async function getNextDropId() {
    return queryView('get_next_drop_id');
  }

  async function getNextListingId() {
    return queryView('get_next_listing_id');
  }

  // Load all drops from chain
  async function getAllDrops() {
    const result = await getNextDropId();
    const nextId = parseInt(JSON.parse(result.data));
    const drops = [];
    for (let i = 1; i < nextId; i++) {
      try {
        const r = await getDrop(i);
        const info = JSON.parse(r.data);
        drops.push({ id: i, ...info });
      } catch { /* skip deleted/invalid */ }
    }
    return drops;
  }

  // Load all active listings from chain
  async function getAllListings() {
    const result = await getNextListingId();
    const nextId = parseInt(JSON.parse(result.data));
    const listings = [];
    for (let i = 1; i < nextId; i++) {
      try {
        const r = await getListing(i);
        const info = JSON.parse(r.data);
        if (info.active) listings.push({ id: i, ...info });
      } catch { /* skip */ }
    }
    return listings;
  }

  // Helper: resolve denom to metadata object address (hex)
  async function getMetadataAddress(denom) {
    const d = denom || GAS_DENOM;
    const res = await fetch(`${LCD_ENDPOINT}/initia/move/v1/metadata?denom=${d}`);
    if (!res.ok) throw new Error(`Failed to resolve metadata for ${d}`);
    const data = await res.json();
    return data.metadata; // e.g. "0x8e4733bd..."
  }

  return {
    address,
    createDrop,
    purchase,
    authorizeAgent,
    revokeAgent,
    fundAgent,
    createListing,
    buyListing,
    cancelListing,
    getDrop,
    getListing,
    getUserOwned,
    getAgentWallet,
    getNextDropId,
    getNextListingId,
    getAllDrops,
    getAllListings,
  };
}
