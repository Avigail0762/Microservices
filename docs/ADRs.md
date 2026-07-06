# Architecture Decision Records

## ADR 1: OrderService uses SQL Server

**Status:** Accepted

**Context**
OrderService manages users, authentication, carts, and ticket purchases. These operations must be reliable because they affect purchase data and user state.

**Decision**
Use SQL Server as a relational database for OrderService.

**Reasoning**
This service requires ACID guarantees:
- Atomicity: a purchase must complete fully or fail completely.
- Consistency: ticket and user data must remain valid.
- Isolation: concurrent purchases must not corrupt state.
- Durability: committed purchases must not disappear.

**Consistency Model**
Strong consistency.

**CAP Perspective**
Prefer CP. For money and purchase records, consistency is more important than availability during a partition.

**Consequences**
OrderService remains the source of truth for users and tickets. Checkout logic stays transactional.

---

## ADR 2: ProductCatalogService uses MongoDB

**Status:** Accepted

**Context**
ProductCatalogService stores gifts and donors. Gift data can vary by category and may include optional attributes like description, category, winner ticket, and draw state.

**Decision**
Use MongoDB as a document database for ProductCatalogService.

**Reasoning**
The catalog fits the document model because gift records are flexible and do not need a rigid relational schema. MongoDB supports this well and works naturally with BASE-style behavior for read-heavy catalog data.

**Consistency Model**
Eventual consistency is acceptable for catalog reads.

**CAP Perspective**
Favor flexibility and availability for reads, while keeping enough consistency for updates.

**Consequences**
New gift fields can be added with minimal schema changes. The catalog is easier to evolve than a rigid relational design.

---

## ADR 3: InventoryService uses MongoDB

**Status:** Accepted

**Context**
InventoryService stores ticket records and supports lottery operations and reporting. Ticket data is naturally document-shaped and can be stored independently from the order database.

**Decision**
Use MongoDB as the database for InventoryService.

**Reasoning**
Inventory data is not the money source of truth. OrderService owns the transactional checkout data. InventoryService mainly tracks tickets and lottery state, so a document database is a good fit. BASE and eventual consistency are acceptable for inventory views and reporting.

**Consistency Model**
Eventual consistency for inventory tracking and lottery reports.

**CAP Perspective**
Prefer AP for resilience and service availability.

**Consequences**
InventoryService can scale independently and store ticket-related data without depending on the SQL schema.

---

## ADR 4: Purchase flow uses RabbitMQ choreography saga

**Status:** Accepted

**Context**
The original purchase flow in OrderService called ProductCatalogService and InventoryService synchronously over HTTP in the same request path. This created temporal coupling, higher latency, and cascading failure risk when downstream services were unavailable.

**Decision**
Use RabbitMQ topic messaging to replace synchronous purchase side effects with asynchronous choreography.

**Reasoning**
- RabbitMQ was selected because it is simple to operate locally with Docker, supports durable queues, and fits command/event fan-out for this project.
- The purchase API should only guarantee local OrderService persistence and event publication, while downstream services apply side effects asynchronously.
- Choreography keeps services decoupled and avoids a central orchestration dependency in this phase.

**Message Topology**
- Exchange: `order.events` (topic, durable)
- Routing keys:
	- `order.events.gift-purchased`
	- `order.events.purchase-failed`
- Consumers:
	- ProductCatalogService increments/decrements buyers counters
	- InventoryService upserts/deletes ticket projections

**Consistency Model**
At-least-once delivery with idempotent consumers and eventual consistency across service boundaries.

**CAP Perspective**
Prefer availability and resilience during partial outages while preserving local transactional consistency in OrderService.

**Consequences**
- Purchase latency and coupling are reduced because downstream updates are asynchronous.
- Cross-service state converges eventually, not atomically.
- Duplicate message handling is mandatory.

---

## ADR 5: Idempotency and compensation strategy for async purchase events

**Status:** Accepted

**Context**
With at-least-once delivery, duplicate event delivery can occur. Without idempotency, counters and ticket projections can drift.

**Decision**
Apply idempotency per consumer and add compensation event handling.

**Reasoning**
- ProductCatalogService uses a ProcessedEvent ledger keyed by `eventId` to prevent duplicate increments/decrements.
- InventoryService relies on Mongo upsert uniqueness by `ticketId` for `gift-purchased` and idempotent delete by `ticketId` for compensation.
- OrderService publishes `purchase-failed` to trigger rollback behavior when needed.

**Consequences**
- Consumers remain safe under retries and broker redelivery.
- Additional storage/logic is required for deduplication in ProductCatalogService.
- Compensations are explicit and auditable through event logs.
