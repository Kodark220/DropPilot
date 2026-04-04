module initia_drops::drops {
    use std::string::String;
    use std::signer;
    use std::error;

    use initia_std::object::Object;
    use initia_std::event;
    use initia_std::block::get_block_info;
    use initia_std::table::{Self, Table};
    use initia_std::coin;
    use initia_std::fungible_asset::Metadata;

    // ==================== Error Codes ====================
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_DROP_NOT_FOUND: u64 = 2;
    const E_DROP_NOT_ACTIVE: u64 = 3;
    const E_DROP_SOLD_OUT: u64 = 4;
    const E_ALREADY_PURCHASED: u64 = 5;
    const E_INSUFFICIENT_PAYMENT: u64 = 6;
    const E_DROP_NOT_STARTED: u64 = 7;
    const E_DROP_ENDED: u64 = 8;
    const E_LISTING_NOT_FOUND: u64 = 9;
    const E_NOT_LISTING_OWNER: u64 = 10;
    const E_BUDGET_EXCEEDED: u64 = 11;
    const E_AGENT_NOT_AUTHORIZED: u64 = 12;
    const E_INVALID_QUANTITY: u64 = 13;

    // ==================== Structs ====================

    /// Global registry stored at the module publisher's address
    struct Registry has key {
        drops: Table<u64, DropInfo>,
        next_drop_id: u64,
        listings: Table<u64, SecondaryListing>,
        next_listing_id: u64,
        // Centralized purchase records: (address, drop_id) -> quantity purchased
        purchase_records: Table<address, Table<u64, u64>>,
        // Centralized receipts: (address, drop_id) -> quantity owned
        receipts: Table<address, Table<u64, u64>>,
    }

    /// Info about a single drop
    struct DropInfo has store, copy, drop {
        creator: address,
        name: String,
        description: String,
        price: u64,
        payment_metadata: Object<Metadata>,
        total_supply: u64,
        sold: u64,
        max_per_user: u64,
        start_time: u64,
        end_time: u64,
        active: bool,
    }

    /// Agent wallet - users delegate spending to agents
    struct AgentWallet has key {
        agent: address,
        budget: u64,
        spent: u64,
        active: bool,
    }

    /// Secondary market listing
    struct SecondaryListing has store, copy, drop {
        seller: address,
        drop_id: u64,
        quantity: u64,
        price_per_unit: u64,
        payment_metadata: Object<Metadata>,
        active: bool,
    }

    // ==================== Events ====================

    #[event]
    struct DropCreatedEvent has drop, store {
        drop_id: u64,
        creator: address,
        name: String,
        price: u64,
        total_supply: u64,
        start_time: u64,
        end_time: u64,
    }

    #[event]
    struct PurchaseEvent has drop, store {
        drop_id: u64,
        buyer: address,
        quantity: u64,
        total_paid: u64,
    }

    #[event]
    struct AgentPurchaseEvent has drop, store {
        drop_id: u64,
        buyer: address,
        agent: address,
        quantity: u64,
        total_paid: u64,
    }

    #[event]
    struct ListingCreatedEvent has drop, store {
        listing_id: u64,
        seller: address,
        drop_id: u64,
        quantity: u64,
        price_per_unit: u64,
    }

    #[event]
    struct ListingPurchasedEvent has drop, store {
        listing_id: u64,
        buyer: address,
        seller: address,
        quantity: u64,
        total_paid: u64,
    }

    #[event]
    struct AgentAuthorizedEvent has drop, store {
        owner: address,
        agent: address,
        budget: u64,
    }

    // ==================== Init ====================

    fun init_module(account: &signer) {
        move_to(account, Registry {
            drops: table::new(),
            next_drop_id: 1,
            listings: table::new(),
            next_listing_id: 1,
            purchase_records: table::new(),
            receipts: table::new(),
        });
    }

    // ==================== Drop Management ====================

    /// Create a new drop (seller/brand)
    public entry fun create_drop(
        creator: &signer,
        name: String,
        description: String,
        price: u64,
        payment_metadata: Object<Metadata>,
        total_supply: u64,
        max_per_user: u64,
        start_time: u64,
        end_time: u64,
    ) acquires Registry {
        let creator_addr = signer::address_of(creator);
        let registry = borrow_global_mut<Registry>(@initia_drops);
        let drop_id = registry.next_drop_id;

        let drop = DropInfo {
            creator: creator_addr,
            name,
            description,
            price,
            payment_metadata,
            total_supply,
            sold: 0,
            max_per_user,
            start_time,
            end_time,
            active: true,
        };

        table::add(&mut registry.drops, drop_id, drop);
        registry.next_drop_id = drop_id + 1;

        event::emit(DropCreatedEvent {
            drop_id,
            creator: creator_addr,
            name,
            price,
            total_supply,
            start_time,
            end_time,
        });
    }

    /// Cancel a drop (only creator)
    public entry fun cancel_drop(
        creator: &signer,
        drop_id: u64,
    ) acquires Registry {
        let creator_addr = signer::address_of(creator);
        let registry = borrow_global_mut<Registry>(@initia_drops);
        assert!(table::contains(&registry.drops, drop_id), error::not_found(E_DROP_NOT_FOUND));

        let drop = table::borrow_mut(&mut registry.drops, drop_id);
        assert!(drop.creator == creator_addr, error::permission_denied(E_NOT_AUTHORIZED));
        drop.active = false;
    }

    // ==================== Direct Purchase ====================

    /// Buy from a drop directly
    public entry fun purchase(
        buyer: &signer,
        drop_id: u64,
        quantity: u64,
    ) acquires Registry {
        let buyer_addr = signer::address_of(buyer);
        assert!(quantity > 0, error::invalid_argument(E_INVALID_QUANTITY));

        let registry = borrow_global_mut<Registry>(@initia_drops);
        assert!(table::contains(&registry.drops, drop_id), error::not_found(E_DROP_NOT_FOUND));

        let drop = table::borrow_mut(&mut registry.drops, drop_id);
        assert!(drop.active, error::invalid_state(E_DROP_NOT_ACTIVE));

        // Check timing
        let (_block_height, block_time) = get_block_info();
        assert!(block_time >= drop.start_time, error::invalid_state(E_DROP_NOT_STARTED));
        assert!(block_time <= drop.end_time, error::invalid_state(E_DROP_ENDED));

        // Check supply
        assert!(drop.sold + quantity <= drop.total_supply, error::resource_exhausted(E_DROP_SOLD_OUT));

        // Check per-user limit
        let already_bought = get_purchase_count(&registry.purchase_records, buyer_addr, drop_id);
        assert!(already_bought + quantity <= drop.max_per_user, error::resource_exhausted(E_ALREADY_PURCHASED));

        // Payment
        let total_cost = drop.price * quantity;
        let payment = coin::withdraw(buyer, drop.payment_metadata, total_cost);
        coin::deposit(drop.creator, payment);

        // Update state
        drop.sold = drop.sold + quantity;
        add_purchase_count(&mut registry.purchase_records, buyer_addr, drop_id, quantity);

        // Issue receipt
        add_receipt_count(&mut registry.receipts, buyer_addr, drop_id, quantity);

        event::emit(PurchaseEvent {
            drop_id,
            buyer: buyer_addr,
            quantity,
            total_paid: total_cost,
        });
    }

    // ==================== Agent Wallet ====================

    /// Authorize an agent to spend on your behalf
    public entry fun authorize_agent(
        owner: &signer,
        agent: address,
        budget: u64,
    ) acquires AgentWallet {
        let owner_addr = signer::address_of(owner);

        if (exists<AgentWallet>(owner_addr)) {
            let wallet = borrow_global_mut<AgentWallet>(owner_addr);
            wallet.agent = agent;
            wallet.budget = budget;
            wallet.spent = 0;
            wallet.active = true;
        } else {
            move_to(owner, AgentWallet {
                agent,
                budget,
                spent: 0,
                active: true,
            });
        };

        event::emit(AgentAuthorizedEvent {
            owner: owner_addr,
            agent,
            budget,
        });
    }

    /// Revoke agent access
    public entry fun revoke_agent(owner: &signer) acquires AgentWallet {
        let owner_addr = signer::address_of(owner);
        assert!(exists<AgentWallet>(owner_addr), error::not_found(E_AGENT_NOT_AUTHORIZED));
        let wallet = borrow_global_mut<AgentWallet>(owner_addr);
        wallet.active = false;
    }

    /// Agent purchases on behalf of a user (auto-sign compatible)
    public entry fun agent_purchase(
        agent: &signer,
        owner_addr: address,
        drop_id: u64,
        quantity: u64,
    ) acquires Registry, AgentWallet {
        let agent_addr = signer::address_of(agent);
        assert!(quantity > 0, error::invalid_argument(E_INVALID_QUANTITY));

        // Verify agent authorization
        assert!(exists<AgentWallet>(owner_addr), error::not_found(E_AGENT_NOT_AUTHORIZED));
        let wallet = borrow_global_mut<AgentWallet>(owner_addr);
        assert!(wallet.active, error::permission_denied(E_AGENT_NOT_AUTHORIZED));
        assert!(wallet.agent == agent_addr, error::permission_denied(E_AGENT_NOT_AUTHORIZED));

        let registry = borrow_global_mut<Registry>(@initia_drops);
        assert!(table::contains(&registry.drops, drop_id), error::not_found(E_DROP_NOT_FOUND));

        let drop = table::borrow_mut(&mut registry.drops, drop_id);
        assert!(drop.active, error::invalid_state(E_DROP_NOT_ACTIVE));

        // Check timing
        let (_block_height, block_time) = get_block_info();
        assert!(block_time >= drop.start_time, error::invalid_state(E_DROP_NOT_STARTED));
        assert!(block_time <= drop.end_time, error::invalid_state(E_DROP_ENDED));

        // Check supply
        assert!(drop.sold + quantity <= drop.total_supply, error::resource_exhausted(E_DROP_SOLD_OUT));

        // Check per-user limit
        let already_bought = get_purchase_count(&registry.purchase_records, owner_addr, drop_id);
        assert!(already_bought + quantity <= drop.max_per_user, error::resource_exhausted(E_ALREADY_PURCHASED));

        // Check budget
        let total_cost = drop.price * quantity;
        assert!(wallet.spent + total_cost <= wallet.budget, error::resource_exhausted(E_BUDGET_EXCEEDED));

        // Payment from agent's account
        let payment = coin::withdraw(agent, drop.payment_metadata, total_cost);
        coin::deposit(drop.creator, payment);

        // Update agent wallet
        wallet.spent = wallet.spent + total_cost;

        // Update drop state
        drop.sold = drop.sold + quantity;
        add_purchase_count(&mut registry.purchase_records, owner_addr, drop_id, quantity);

        // Issue receipt to owner
        add_receipt_count(&mut registry.receipts, owner_addr, drop_id, quantity);

        event::emit(AgentPurchaseEvent {
            drop_id,
            buyer: owner_addr,
            agent: agent_addr,
            quantity,
            total_paid: total_cost,
        });
    }

    // ==================== Secondary Market ====================

    /// List items for resale
    public entry fun create_listing(
        seller: &signer,
        drop_id: u64,
        quantity: u64,
        price_per_unit: u64,
        payment_metadata: Object<Metadata>,
    ) acquires Registry {
        let seller_addr = signer::address_of(seller);
        assert!(quantity > 0, error::invalid_argument(E_INVALID_QUANTITY));

        let registry = borrow_global_mut<Registry>(@initia_drops);

        // Verify seller owns enough
        let owned_count = get_receipt_count(&registry.receipts, seller_addr, drop_id);
        assert!(owned_count >= quantity, error::resource_exhausted(E_INVALID_QUANTITY));

        // Deduct from seller's receipt (lock items)
        sub_receipt_count(&mut registry.receipts, seller_addr, drop_id, quantity);

        let listing_id = registry.next_listing_id;

        let listing = SecondaryListing {
            seller: seller_addr,
            drop_id,
            quantity,
            price_per_unit,
            payment_metadata,
            active: true,
        };

        table::add(&mut registry.listings, listing_id, listing);
        registry.next_listing_id = listing_id + 1;

        event::emit(ListingCreatedEvent {
            listing_id,
            seller: seller_addr,
            drop_id,
            quantity,
            price_per_unit,
        });
    }

    /// Buy from secondary market
    public entry fun buy_listing(
        buyer: &signer,
        listing_id: u64,
    ) acquires Registry {
        let buyer_addr = signer::address_of(buyer);

        let registry = borrow_global_mut<Registry>(@initia_drops);
        assert!(table::contains(&registry.listings, listing_id), error::not_found(E_LISTING_NOT_FOUND));

        let listing = table::borrow_mut(&mut registry.listings, listing_id);
        assert!(listing.active, error::invalid_state(E_LISTING_NOT_FOUND));

        let total_cost = listing.price_per_unit * listing.quantity;
        let payment = coin::withdraw(buyer, listing.payment_metadata, total_cost);
        coin::deposit(listing.seller, payment);

        // Transfer receipt to buyer
        let drop_id = listing.drop_id;
        let quantity = listing.quantity;
        listing.active = false;

        add_receipt_count(&mut registry.receipts, buyer_addr, drop_id, quantity);

        event::emit(ListingPurchasedEvent {
            listing_id,
            buyer: buyer_addr,
            seller: listing.seller,
            quantity,
            total_paid: total_cost,
        });
    }

    /// Cancel a listing (return items to seller)
    public entry fun cancel_listing(
        seller: &signer,
        listing_id: u64,
    ) acquires Registry {
        let seller_addr = signer::address_of(seller);

        let registry = borrow_global_mut<Registry>(@initia_drops);
        assert!(table::contains(&registry.listings, listing_id), error::not_found(E_LISTING_NOT_FOUND));

        let listing = table::borrow_mut(&mut registry.listings, listing_id);
        assert!(listing.seller == seller_addr, error::permission_denied(E_NOT_LISTING_OWNER));
        assert!(listing.active, error::invalid_state(E_LISTING_NOT_FOUND));

        // Return items
        let drop_id = listing.drop_id;
        let quantity = listing.quantity;
        listing.active = false;

        add_receipt_count(&mut registry.receipts, seller_addr, drop_id, quantity);
    }

    /// Agent buys from secondary market on behalf of owner
    public entry fun agent_buy_listing(
        agent: &signer,
        owner_addr: address,
        listing_id: u64,
    ) acquires Registry, AgentWallet {
        let agent_addr = signer::address_of(agent);

        // Verify agent authorization
        assert!(exists<AgentWallet>(owner_addr), error::not_found(E_AGENT_NOT_AUTHORIZED));
        let wallet = borrow_global_mut<AgentWallet>(owner_addr);
        assert!(wallet.active, error::permission_denied(E_AGENT_NOT_AUTHORIZED));
        assert!(wallet.agent == agent_addr, error::permission_denied(E_AGENT_NOT_AUTHORIZED));

        let registry = borrow_global_mut<Registry>(@initia_drops);
        assert!(table::contains(&registry.listings, listing_id), error::not_found(E_LISTING_NOT_FOUND));

        let listing = table::borrow_mut(&mut registry.listings, listing_id);
        assert!(listing.active, error::invalid_state(E_LISTING_NOT_FOUND));

        let total_cost = listing.price_per_unit * listing.quantity;
        assert!(wallet.spent + total_cost <= wallet.budget, error::resource_exhausted(E_BUDGET_EXCEEDED));

        // Agent pays
        let payment = coin::withdraw(agent, listing.payment_metadata, total_cost);
        coin::deposit(listing.seller, payment);
        wallet.spent = wallet.spent + total_cost;

        // Transfer receipt to owner
        let drop_id = listing.drop_id;
        let quantity = listing.quantity;
        listing.active = false;

        add_receipt_count(&mut registry.receipts, owner_addr, drop_id, quantity);

        event::emit(ListingPurchasedEvent {
            listing_id,
            buyer: owner_addr,
            seller: listing.seller,
            quantity,
            total_paid: total_cost,
        });
    }

    // ==================== View Functions ====================

    #[view]
    public fun get_drop(drop_id: u64): DropInfo acquires Registry {
        let registry = borrow_global<Registry>(@initia_drops);
        assert!(table::contains(&registry.drops, drop_id), error::not_found(E_DROP_NOT_FOUND));
        *table::borrow(&registry.drops, drop_id)
    }

    #[view]
    public fun get_listing(listing_id: u64): SecondaryListing acquires Registry {
        let registry = borrow_global<Registry>(@initia_drops);
        assert!(table::contains(&registry.listings, listing_id), error::not_found(E_LISTING_NOT_FOUND));
        *table::borrow(&registry.listings, listing_id)
    }

    #[view]
    public fun get_user_purchases(user: address, drop_id: u64): u64 acquires Registry {
        let registry = borrow_global<Registry>(@initia_drops);
        get_purchase_count(&registry.purchase_records, user, drop_id)
    }

    #[view]
    public fun get_user_owned(user: address, drop_id: u64): u64 acquires Registry {
        let registry = borrow_global<Registry>(@initia_drops);
        get_receipt_count(&registry.receipts, user, drop_id)
    }

    #[view]
    public fun get_agent_wallet(owner: address): (address, u64, u64, bool) acquires AgentWallet {
        assert!(exists<AgentWallet>(owner), error::not_found(E_AGENT_NOT_AUTHORIZED));
        let wallet = borrow_global<AgentWallet>(owner);
        (wallet.agent, wallet.budget, wallet.spent, wallet.active)
    }

    #[view]
    public fun get_next_drop_id(): u64 acquires Registry {
        borrow_global<Registry>(@initia_drops).next_drop_id
    }

    #[view]
    public fun get_next_listing_id(): u64 acquires Registry {
        borrow_global<Registry>(@initia_drops).next_listing_id
    }

    // ==================== Internal Helpers ====================

    fun get_purchase_count(records: &Table<address, Table<u64, u64>>, addr: address, drop_id: u64): u64 {
        if (!table::contains(records, addr)) return 0;
        let user_table = table::borrow(records, addr);
        if (table::contains(user_table, drop_id)) {
            *table::borrow(user_table, drop_id)
        } else {
            0
        }
    }

    fun add_purchase_count(records: &mut Table<address, Table<u64, u64>>, addr: address, drop_id: u64, quantity: u64) {
        if (!table::contains(records, addr)) {
            table::add(records, addr, table::new());
        };
        let user_table = table::borrow_mut(records, addr);
        if (table::contains(user_table, drop_id)) {
            let count = table::borrow_mut(user_table, drop_id);
            *count = *count + quantity;
        } else {
            table::add(user_table, drop_id, quantity);
        };
    }

    fun get_receipt_count(receipts: &Table<address, Table<u64, u64>>, addr: address, drop_id: u64): u64 {
        if (!table::contains(receipts, addr)) return 0;
        let user_table = table::borrow(receipts, addr);
        if (table::contains(user_table, drop_id)) {
            *table::borrow(user_table, drop_id)
        } else {
            0
        }
    }

    fun add_receipt_count(receipts: &mut Table<address, Table<u64, u64>>, addr: address, drop_id: u64, quantity: u64) {
        if (!table::contains(receipts, addr)) {
            table::add(receipts, addr, table::new());
        };
        let user_table = table::borrow_mut(receipts, addr);
        if (table::contains(user_table, drop_id)) {
            let count = table::borrow_mut(user_table, drop_id);
            *count = *count + quantity;
        } else {
            table::add(user_table, drop_id, quantity);
        };
    }

    fun sub_receipt_count(receipts: &mut Table<address, Table<u64, u64>>, addr: address, drop_id: u64, quantity: u64) {
        let user_table = table::borrow_mut(receipts, addr);
        let count = table::borrow_mut(user_table, drop_id);
        *count = *count - quantity;
    }
}
