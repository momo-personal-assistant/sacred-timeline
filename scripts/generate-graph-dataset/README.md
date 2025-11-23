# Graph Dataset Generator V2

**RnD Week 1 - Memory Graph Synthetic Data Generation**

## Overview

Graph Dataset Generator V2 creates realistic synthetic datasets for testing the **Sales <> Dev Memory Graph** system. Unlike traditional data generators, this focuses on capturing the **decision context** that doesn't exist in Zendesk or Linear APIs.

### Why Synthetic Data?

Real customer data doesn't exist yet - we only have 3 test Zendesk tickets. Creating 100+ realistic tickets manually is impossible. Synthetic data generation is **required**, not optional, for validating our Graph and Reasoning layers.

### What Makes This Different?

This generator extends Phase 5 work with two critical additions:

1. **Slack Threads** - Captures human decision-making process (missing from all APIs)
2. **Relation Ground Truth** - Validates our graph inference logic

## Architecture

```
scripts/generate-graph-dataset/
├── types.ts              # Core type definitions
├── config.ts             # Scenario configurations
├── generators/
│   ├── companies.ts      # Company generator
│   ├── users.ts          # User generator (internal + customers)
│   ├── slack.ts          # Slack thread generator (CORE INNOVATION)
│   └── relations.ts      # Relation builder (ground truth)
├── index.ts              # Main orchestrator
├── validate.ts           # Dataset validator
└── test-*.ts             # Test files for each day
```

## Generated Datasets

### Data Model

```typescript
GraphDataset = {
  metadata: {
    scenario: "normal" | "sales_heavy" | "dev_heavy" | "pattern" | "stress"
    generated_at: ISO timestamp
    version: "2.0"
    stats: { companies, users, tickets, threads, issues, relations }
  }
  companies: Company[]
  users: User[]
  zendesk_tickets: ZendeskTicket[]
  slack_threads: SlackThread[]      // NEW!
  linear_issues: LinearIssue[]
  relations: RelationHint[]         // NEW!
}
```

### Scenarios

| Scenario        | Description                                     | Tickets | Threads | Issues | Size   |
| --------------- | ----------------------------------------------- | ------- | ------- | ------ | ------ |
| **normal**      | Realistic baseline - typical week at B2B SaaS   | 50      | 29      | 9      | 578 KB |
| **sales_heavy** | High-touch enterprise with many escalations     | 40      | 38      | 22     | 731 KB |
| **dev_heavy**   | High volume technical bugs with direct tracking | 80      | 39      | 31     | 947 KB |
| **pattern**     | Pattern detection test with recurring issues    | 60      | 38      | 22     | 844 KB |
| **stress**      | Large volume for performance testing            | 200     | 121     | 51     | 2.5 MB |

## Usage

### Generate All Scenarios

```bash
pnpm exec tsx scripts/generate-graph-dataset/index.ts --all
```

### Generate Specific Scenario

```bash
pnpm exec tsx scripts/generate-graph-dataset/index.ts --scenarios=normal
pnpm exec tsx scripts/generate-graph-dataset/index.ts --scenarios=normal,stress
```

### Validate Datasets

```bash
pnpm exec tsx scripts/generate-graph-dataset/validate.ts
```

### Run Tests

```bash
# Test individual components
pnpm exec tsx scripts/generate-graph-dataset/test-day2.ts  # Companies & Users
pnpm exec tsx scripts/generate-graph-dataset/test-day3.ts  # Slack Threads
pnpm exec tsx scripts/generate-graph-dataset/test-day4.ts  # Relations
```

## Key Features

### 1. Slack Thread Generation (Day 3)

**The Core Innovation** - Captures decision context missing from APIs.

```typescript
SlackThread = {
  ts: "1732406400.123456"
  messages: [
    { bot_id: "B09UMQGC2PP", text: "New Zendesk ticket..." },  // Zendesk bot
    { user_id: "user_27", text: "Can eng take a look?" },      // Support
    { user_id: "user_31", text: "I'll create a Linear issue" } // Decision!
  ]
  triggered_by_ticket: "10001"    // Link to Zendesk
  resulted_in_issue: "ENG-101"    // Link to Linear
  decision_made: true
  decided_by: "user_31"
  keywords: ["performance", "timeout"]
  sentiment: "concerned"
}
```

**Realistic conversation flow:**

- Phase 1: Investigation (40%) - Understanding the issue
- Phase 2: Discussion (40%) - Figuring out root cause
- Phase 3: Decision (20%) - Creating Linear issue or not

### 2. Relation Ground Truth (Day 4)

Relations are the "answer key" for validating graph inference.

**Relation Format:** `platform|workspace|object_type|id`

Examples:

- `zendesk|momo|ticket|10001`
- `slack|momo|thread|1732406400.123456`
- `linear|momo|issue|ENG-101`

**Relation Types:**

| Type              | Source   | Description                        |
| ----------------- | -------- | ---------------------------------- |
| `triggered_by`    | explicit | Slack thread → Zendesk ticket      |
| `resulted_in`     | explicit | Slack thread → Linear issue        |
| `belongs_to`      | explicit | User/Ticket → Company              |
| `participated_in` | explicit | User → Slack thread                |
| `decided_by`      | explicit | User → Thread decision             |
| `created_by`      | explicit | User → Linear issue                |
| `assigned_to`     | explicit | Issue → User                       |
| `similar_to`      | computed | Thread ↔ Thread (keyword overlap) |

### 3. Company & User Management (Day 2)

**Tier-based companies:**

- 20% Enterprise (500-5000 employees)
- 40% Growth (50-499 employees)
- 40% Startup (5-49 employees)

**Role distribution:**

- Customer users (assigned to companies)
- Internal users (support, engineering, sales, product)

## Validation Results

All 5 datasets passed validation:

```
✅ normal:       213 relations, all types present
✅ sales_heavy:  336 relations, high discussion rate
✅ dev_heavy:    347 relations, high issue creation
✅ pattern:      292 relations, recurring patterns
✅ stress:      1168 relations, large volume test
```

## Development Timeline

- **Day 1**: Types & Config (types.ts, config.ts)
- **Day 2**: Companies & Users (generators/companies.ts, generators/users.ts)
- **Day 3**: Slack Threads (generators/slack.ts) - **Core Innovation**
- **Day 4**: Relations (generators/relations.ts) - **Ground Truth**
- **Day 5**: Orchestrator & Validation (index.ts, validate.ts)

## Next Steps

1. **Graph Construction** - Build PostgreSQL schema for canonical objects
2. **Relation Inference** - Test auto-detection of Zendesk → Slack links
3. **Embedding Layer** - Generate embeddings for similarity search
4. **Reasoning Queries** - Validate graph queries against ground truth

## File Locations

```
data/
└── graph-datasets/
    ├── normal.json         # 578 KB
    ├── sales_heavy.json    # 731 KB
    ├── dev_heavy.json      # 947 KB
    ├── pattern.json        # 844 KB
    └── stress.json         # 2.5 MB
```

## Key Insights

1. **Ingestion is easy** - The real value is in Graph + Reasoning
2. **Relations don't exist in APIs** - Must be inferred or explicitly created
3. **Decision context is missing** - Slack threads capture the "why" behind Linear issues
4. **Synthetic data is required** - Can't manually create 100+ realistic tickets
5. **Ground truth validates inference** - Relations serve as "answer key"

## Contributing

When adding new scenarios:

1. Define scenario in `config.ts`
2. Run generation: `pnpm exec tsx scripts/generate-graph-dataset/index.ts --scenarios=new`
3. Validate: `pnpm exec tsx scripts/generate-graph-dataset/validate.ts`
4. Verify relation types and counts match expectations
