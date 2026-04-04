import { useInterwovenKit } from '@initia/interwovenkit-react';
import { MODULE_ADDRESS, GAS_DENOM, LCD_ENDPOINT } from '../main';

/**
 * Hook that provides helpers for interacting with the DropPilot Move module.
 * Uses InterwovenKit's requestTxBlock for signing + broadcasting.
 */
export function useDropsContract() {
  const { address, requestTxBlock } = useInterwovenKit();

  // Build a MsgExecute for calling a Move entry function
  function buildMoveExecuteMsg(functionName, typeArgs = [], args = []) {
    return {
      typeUrl: '/initia.move.v1.MsgExecute',
      value: {
        sender: address,
        module_address: MODULE_ADDRESS,
        module_name: 'drops',
        function_name: functionName,
        type_args: typeArgs,
        args: args.map((a) => btoa(String(a))), // base64 encode args
      },
    };
  }

  // Query a view function on the module
  async function queryView(functionName, args = []) {
    const body = {
      module_address: MODULE_ADDRESS,
      module_name: 'drops',
      function_name: functionName,
      type_args: [],
      args: args.map((a) => btoa(String(a))),
    };

    const res = await fetch(`${LCD_ENDPOINT}/initia/move/v1/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`View query failed: ${await res.text()}`);
    return res.json();
  }

  // ==================== Drop Actions ====================

  async function createDrop({ name, description, price, paymentDenom, totalSupply, maxPerUser, startTime, endTime }) {
    const metadataAddr = await getMetadataAddress(paymentDenom);
    const msg = buildMoveExecuteMsg('create_drop', [], [
      name,
      description,
      String(price),
      metadataAddr,
      String(totalSupply),
      String(maxPerUser),
      String(startTime),
      String(endTime),
    ]);
    return requestTxBlock({ messages: [msg] });
  }

  async function purchase(dropId, quantity) {
    const msg = buildMoveExecuteMsg('purchase', [], [
      String(dropId),
      String(quantity),
    ]);
    return requestTxBlock({ messages: [msg] });
  }

  async function authorizeAgent(agentAddress, budget) {
    const msg = buildMoveExecuteMsg('authorize_agent', [], [
      agentAddress,
      String(budget),
    ]);
    return requestTxBlock({ messages: [msg] });
  }

  async function revokeAgent() {
    const msg = buildMoveExecuteMsg('revoke_agent', [], []);
    return requestTxBlock({ messages: [msg] });
  }

  // Send tokens from connected wallet to the agent address
  async function fundAgent(amount) {
    const msg = {
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: {
        from_address: address,
        to_address: MODULE_ADDRESS,
        amount: [{ denom: GAS_DENOM, amount: String(amount) }],
      },
    };
    return requestTxBlock({ messages: [msg] });
  }

  async function createListing(dropId, quantity, pricePerUnit, paymentDenom) {
    const metadataAddr = await getMetadataAddress(paymentDenom);
    const msg = buildMoveExecuteMsg('create_listing', [], [
      String(dropId),
      String(quantity),
      String(pricePerUnit),
      metadataAddr,
    ]);
    return requestTxBlock({ messages: [msg] });
  }

  async function buyListing(listingId) {
    const msg = buildMoveExecuteMsg('buy_listing', [], [String(listingId)]);
    return requestTxBlock({ messages: [msg] });
  }

  async function cancelListing(listingId) {
    const msg = buildMoveExecuteMsg('cancel_listing', [], [String(listingId)]);
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
  };
}
