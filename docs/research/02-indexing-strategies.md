# Indexing Strategies Research

**Date**: 2025-11-23
**Author**: RND Week 1
**Purpose**: Canonical data model 설계 원칙 이해 및 Momo의 unified schema 검증

---

## Table of Contents

1. [Canonical Data Model 이론](#1-canonical-data-model-이론)
2. [실제 구현 사례 분석](#2-실제-구현-사례-분석)
3. [Graph vs Document Indexing](#3-graph-vs-document-indexing)
4. [PostgreSQL JSONB 전략](#4-postgresql-jsonb-전략)
5. [현재 Momo Schema 분석](#5-현재-momo-schema-분석)
6. [개선 방안 및 의사결정](#6-개선-방안-및-의사결정)

---

## 1. Canonical Data Model 이론

### 1.1 What is a Canonical Data Model (CDM)?

**Definition**: 여러 시스템/플랫폼의 데이터를 통합하기 위한 공통 표현 형식

**핵심 개념**:

```
System A (Linear)  ──┐
                      ├──→ Canonical Model ──→ Unified Access
System B (Zendesk) ──┤
                      │
System C (GitHub)  ──┘
```

**Traditional Approach (N² Problem)**:

```
Linear ←→ Zendesk
Linear ←→ GitHub
Zendesk ←→ GitHub

= 3 systems × 2 directions = 6 transformations
= N systems = N × (N-1) = N² complexity
```

**Canonical Approach (2N Solution)**:

```
Linear → CDM
Zendesk → CDM
GitHub → CDM

+ CDM → Query Layer

= N systems × 2 (ingest + access) = 2N complexity
```

**Benefits**:

- ✅ **Scalability**: 새 플랫폼 추가 = +2 mappings (not +N)
- ✅ **Consistency**: 모든 데이터가 동일한 구조
- ✅ **Flexibility**: 새로운 query 패턴 쉽게 추가
- ✅ **Maintainability**: 중앙집중식 스키마 관리

### 1.2 Industry Standards: Schema.org

**Schema.org Data Model**:

- **Format**: RDF/Turtle (Resource Description Framework)
- **Philosophy**: Pragmatic conformance over strict enforcement
- **Flexibility**: Open-world assumption (extensibility built-in)

**Key Principles**:

1. **Start Small, Scale Gradually**: 핵심 엔티티부터 시작, 점진적 확장
2. **Clarity > Completeness**: 이해하기 쉽고 재사용 가능한 모델
3. **Favor Simplicity**: 복잡도는 필요할 때만 추가

**Example Schema.org Mapping**:

```json
{
  "@context": "https://schema.org",
  "@type": "CreativeWork", // Generic content type
  "name": "Add authentication feature",
  "author": {
    "@type": "Person",
    "name": "John Doe"
  },
  "dateCreated": "2025-11-01T10:00:00Z",
  "dateModified": "2025-11-20T15:30:00Z",
  "about": {
    "@type": "SoftwareApplication",
    "name": "Momo"
  }
}
```

### 1.3 Healthcare Standard: HL7 FHIR

**FHIR (Fast Healthcare Interoperability Resources)**:

- **Architecture**: Resource-based (modularity)
- **API**: RESTful endpoints (pragmatic integration)
- **Design**: 80/20 principle (common cases first, extensions for edge cases)

**Core Patterns**:

#### A. Resource-Based Granularity

```json
// Patient Resource
{
  "resourceType": "Patient",
  "id": "example",
  "name": [{ "use": "official", "family": "Doe", "given": ["John"] }],
  "birthDate": "1990-01-01"
}

// Observation Resource (linked)
{
  "resourceType": "Observation",
  "subject": { "reference": "Patient/example" },
  "code": { "text": "Blood Pressure" },
  "valueQuantity": { "value": 120, "unit": "mmHg" }
}
```

#### B. Common Data Model Harmonization

- **Problem**: Multiple source systems with different schemas
- **Solution**: Map all to FHIR resources
- **Benefit**: Cross-system queries without N² transformations

#### C. Extension Mechanism (80/20)

```json
{
  "resourceType": "Patient",
  "id": "custom-fields-example",
  // Core FHIR fields (80%)
  "name": [{ "family": "Doe" }],

  // Custom extensions (20%)
  "extension": [
    {
      "url": "http://example.com/patient-loyalty-tier",
      "valueString": "platinum"
    }
  ]
}
```

**Lessons for Momo**:

- ✅ 핵심 필드는 top-level (title, body, actors, timestamps)
- ✅ Platform-specific 필드는 `properties` JSONB에 저장
- ✅ 80%의 use case는 canonical fields로 해결, 20%는 JSONB로

### 1.4 CDM Best Practices (2024)

#### 1. Governance is Critical

```typescript
interface SchemaGovernance {
  owner: string; // "platform-team"
  versionControl: boolean; // Git-based schema versioning
  changeApproval: 'team-review' | 'auto-merge';
  documentation: 'mandatory'; // Every field must be documented
}
```

**Why**: Schema drift 방지, 팀 간 일관성 유지

#### 2. Collaboration Early

- ✅ **Technical + Business**: Engineers + Product managers
- ✅ **Top-down + Bottom-up**: Enterprise vision + Practical needs

#### 3. Versioning & Changelogs

```typescript
interface SchemaVersion {
  version: string; // "v2.1.0"
  releaseDate: Date;
  changes: {
    added: string[]; // New fields
    deprecated: string[]; // Fields to remove in next major version
    breaking: string[]; // Incompatible changes
  };
  migrationGuide: string; // How to upgrade from previous version
}
```

#### 4. Prefer Additive Changes

- ✅ **Add**: New optional fields (backward compatible)
- ⚠️ **Modify**: Change field types (requires migration)
- ❌ **Remove**: Delete fields (breaking change, avoid!)

**Strategy**: Mark as deprecated first, remove after 2 versions

---

## 2. 실제 구현 사례 분석

### 2.1 Notion: Block-Based Universal Model

**Architecture**: Everything is a block

```typescript
interface NotionBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'database_row' | 'page' | 'image' | ...;

  // Core properties
  properties: {
    title?: RichText[];
    [key: string]: any;  // Type-specific properties
  };

  // Hierarchy
  parent: { type: 'page_id' | 'database_id', id: string };
  children?: Block[];

  // Metadata
  created_time: string;
  last_edited_time: string;
  created_by: User;
  last_edited_by: User;
}
```

**Key Insights**:

1. **Single Abstraction**: Page = Block, Database Row = Block, Text = Block
2. **Composability**: Blocks contain blocks (recursive structure)
3. **Type Flexibility**: `type` field determines interpretation
4. **Property Polymorphism**: Properties vary by block type

**Pros**:

- ✅ Extreme flexibility (any content type)
- ✅ Recursive structure = natural hierarchy
- ✅ Easy to add new block types

**Cons**:

- ⚠️ Type safety challenges (properties not strongly typed)
- ⚠️ Query complexity (need to filter by type constantly)

**Momo Applicability**:

- ✅ Similar philosophy: `object_type` field + flexible JSONB
- ✅ Hierarchical relations: `relations.parent_id`
- ⚠️ We need stronger typing than Notion (TypeScript interfaces)

### 2.2 Airtable: Relational Database Model

**Architecture**: Tables + Typed Fields + Linked Records

```typescript
interface AirtableRecord {
  id: string;
  fields: {
    [fieldName: string]:
      | string
      | number
      | boolean
      | Date
      | Attachment[]
      | LinkedRecord[];  // References to other tables
  };
  createdTime: string;
}

interface AirtableField {
  id: string;
  name: string;
  type: 'singleLineText' | 'number' | 'date' | 'multipleRecordLinks' | ...;
  options?: {
    // Type-specific configuration
    linkedTableId?: string;  // For links
    precision?: number;  // For numbers
  };
}
```

**Key Insights**:

1. **Explicit Typing**: 각 field가 명시적 타입 가짐
2. **Relational Links**: `LinkedRecord` = foreign key equivalent
3. **Schema Definition**: Fields는 table schema에 정의됨
4. **Validation**: Type enforcement at write time

**Pros**:

- ✅ Strong typing = data integrity
- ✅ Relational queries = complex joins
- ✅ User-friendly = non-technical users can define schema

**Cons**:

- ⚠️ Less flexible than Notion
- ⚠️ Schema changes require migration
- ⚠️ Each table = separate entity (harder to query across)

**Momo Applicability**:

- ✅ We use typed fields for core: `platform`, `object_type`, `visibility`
- ✅ Relations via `relations` JSONB (more flexible than Airtable)
- ✅ Hybrid approach: Strong types + JSONB flexibility

### 2.3 Comparison: Notion vs Airtable vs Momo

| Aspect               | Notion                    | Airtable             | Momo (Current)                        |
| -------------------- | ------------------------- | -------------------- | ------------------------------------- |
| **Core Abstraction** | Block (everything)        | Record (table row)   | CanonicalObject (platform-agnostic)   |
| **Flexibility**      | ⭐⭐⭐⭐⭐                | ⭐⭐⭐               | ⭐⭐⭐⭐                              |
| **Type Safety**      | ⭐⭐                      | ⭐⭐⭐⭐             | ⭐⭐⭐⭐ (TS types)                   |
| **Query Power**      | ⭐⭐⭐                    | ⭐⭐⭐⭐⭐           | ⭐⭐⭐⭐⭐ (SQL + JSONB)              |
| **Hierarchy**        | Native (blocks in blocks) | Via links            | Via `relations.parent_id`             |
| **Schema Evolution** | Easy (no schema)          | Hard (migrations)    | Medium (JSONB = easy, columns = hard) |
| **Use Case**         | Knowledge management      | Database replacement | Multi-platform integration            |

**Takeaway**: Momo는 Notion의 유연성 + Airtable의 query power 결합

---

## 3. Graph vs Document Indexing

### 3.1 Document Database Indexing

**Model**: Each object is a self-contained document

```json
{
  "_id": "github|acme|issue|123",
  "platform": "github",
  "type": "issue",
  "title": "Add authentication",
  "labels": ["feature", "security"],
  "assignees": ["user:alice"],
  "comments": [{ "id": "comment-1", "author": "user:bob", "body": "LGTM" }]
}
```

**Indexing Strategy**:

- **Primary Index**: `_id`
- **Secondary Indexes**: `platform`, `labels`, `assignees`
- **Full-Text**: `title`, `body`, `comments.body`

**Pros**:

- ✅ Fast reads (single document fetch)
- ✅ Schema flexibility (each doc can differ)
- ✅ Horizontal scaling (shard by `_id`)

**Cons**:

- ⚠️ Denormalization required (comments embedded)
- ⚠️ Updates = rewrite entire document
- ⚠️ Cross-document joins = application-level

**Query Examples**:

```javascript
// MongoDB-style
db.issues.find({ platform: 'github', labels: 'bug' });
db.issues.find({ assignees: 'user:alice' });
db.issues.find({ $text: { $search: 'authentication' } });
```

### 3.2 Graph Database Indexing

**Model**: Nodes + Relationships

```cypher
// Nodes
(issue:Issue { id: "123", title: "Add auth" })
(user:User { id: "alice" })
(project:Project { id: "proj-1" })

// Relationships
(issue)-[:ASSIGNED_TO]->(user)
(issue)-[:BELONGS_TO]->(project)
(issue)-[:BLOCKS]->(otherIssue)
```

**Indexing Strategy**:

- **Node Indexes**: On node properties (`issue.id`, `user.email`)
- **Relationship Indexes**: On relationship types
- **Index-Free Adjacency**: Nodes physically point to neighbors (fast traversal)

**Pros**:

- ✅ Relationship queries = native (no joins!)
- ✅ Pattern matching = powerful
- ✅ Graph algorithms (shortest path, PageRank, etc.)

**Cons**:

- ⚠️ Overkill for simple CRUD
- ⚠️ Steeper learning curve (Cypher, Gremlin)
- ⚠️ Less mature tooling than SQL

**Query Examples**:

```cypher
// Find all issues assigned to Alice
MATCH (u:User {id: "alice"})<-[:ASSIGNED_TO]-(i:Issue)
RETURN i

// Find issues blocking this issue (transitive)
MATCH (start:Issue {id: "123"})-[:BLOCKS*]->(blocked:Issue)
RETURN blocked

// Find users who collaborated on same project
MATCH (u1:User)<-[:ASSIGNED_TO]-(i:Issue)-[:BELONGS_TO]->(p:Project)
MATCH (p)<-[:BELONGS_TO]-(i2:Issue)-[:ASSIGNED_TO]->(u2:User)
WHERE u1 <> u2
RETURN DISTINCT u1, u2
```

### 3.3 Hybrid: PostgreSQL with JSONB (Momo's Approach)

**Model**: Relational foundation + Document flexibility

```sql
-- Relational core
CREATE TABLE canonical_objects (
  id VARCHAR(255) PRIMARY KEY,
  platform VARCHAR(20) NOT NULL,
  object_type VARCHAR(50) NOT NULL,

  -- Document flexibility
  actors JSONB NOT NULL,
  relations JSONB,
  properties JSONB
);

-- Relational query
SELECT * FROM canonical_objects
WHERE platform = 'github' AND object_type = 'issue';

-- JSONB query (GIN index)
SELECT * FROM canonical_objects
WHERE properties @> '{"status": "open"}';

-- Full-text search (tsvector)
SELECT * FROM canonical_objects
WHERE to_tsvector('english', search_text) @@ to_tsquery('authentication');

-- Combined (best of both worlds)
SELECT * FROM canonical_objects
WHERE platform = 'linear'
  AND actors @> '{"assignees": ["user:alice"]}'
  AND to_tsvector('english', search_text) @@ to_tsquery('bug');
```

**Indexing Advantages**:

1. **GIN Index on JSONB**: Sub-second queries on nested JSON
2. **tsvector for Full-Text**: Built-in ranking, stemming, stop words
3. **B-tree on Columns**: Fast filtering on `platform`, `object_type`
4. **Partial Indexes**: Index only non-deleted rows

**Why This Beats Pure Graph DB**:

- ✅ **Simplicity**: SQL = widely known, easier to hire for
- ✅ **Maturity**: PostgreSQL = battle-tested, rich ecosystem
- ✅ **Flexibility**: JSONB = add fields without migrations
- ✅ **Performance**: GIN indexes on JSONB = comparable to graph for many queries
- ⚠️ **Trade-off**: Complex graph traversals (3+ hops) slower than Neo4j

**When to Consider Graph DB**:

- Deep relationship queries (5+ hops)
- Graph algorithms (community detection, centrality)
- Real-time recommendations based on network

**Momo's Decision**: Stick with PostgreSQL JSONB for now, migrate to graph only if needed

---

## 4. PostgreSQL JSONB 전략

### 4.1 Hybrid Schema Pattern

**Best Practice**: Fixed columns for common fields, JSONB for variable data

```sql
CREATE TABLE canonical_objects (
  -- Fixed columns (fast filtering, strong typing)
  id VARCHAR(255) PRIMARY KEY,
  platform VARCHAR(20) NOT NULL,
  object_type VARCHAR(50) NOT NULL,
  visibility VARCHAR(20) DEFAULT 'team',

  -- JSONB columns (flexibility)
  actors JSONB NOT NULL,
  properties JSONB,
  raw JSONB
);
```

**Rationale**:

- **Fixed columns** = indexed, type-checked, optimized storage
- **JSONB columns** = schema evolution, platform-specific fields

### 4.2 When to Use JSONB

✅ **Good Use Cases**:

1. **Varying Attributes**: Product catalogs (different products = different attributes)
2. **User Preferences**: Settings that change per user
3. **Event Payloads**: Logs with flexible structure
4. **Platform-Specific Data**: GitHub issues ≠ Zendesk tickets

**Example**:

```json
// GitHub issue properties
{
  "labels": ["bug", "P0"],
  "milestone": "v2.0",
  "locked": false,
  "comments_count": 15
}

// Zendesk ticket properties
{
  "tags": ["billing", "urgent"],
  "satisfaction_rating": "good",
  "via": "email",
  "ticket_type": "incident"
}
```

❌ **Bad Use Cases**:

1. **Frequently Updated Small Fields**: Use columns (less overhead)
2. **Foreign Keys**: JSONB can't enforce referential integrity
3. **Highly Structured, Stable Schema**: Use normalization

### 4.3 Performance Considerations

#### Storage Overhead

```
Fixed column:
  - platform VARCHAR(20) = ~20 bytes

JSONB:
  - {"platform": "github"} = ~35 bytes
    (key "platform" + value "github" + metadata)
```

**Impact**: JSONB = 50-100% larger for same data

**Mitigation**:

- ✅ Use short keys: `"p"` instead of `"platform"` (if really needed)
- ✅ TOAST compression auto-kicks in for >2KB documents
- ⚠️ For Momo: Storage is cheap, flexibility > size

#### Query Performance

**Indexed JSONB** (GIN index):

```sql
CREATE INDEX idx_actors_gin ON canonical_objects USING GIN(actors);

-- Fast (uses GIN index)
SELECT * FROM canonical_objects
WHERE actors @> '{"created_by": "user:alice"}';

-- Slower (can't use index efficiently)
SELECT * FROM canonical_objects
WHERE actors->>'created_by' = 'user:alice';  -- Text extraction
```

**Best Practices**:

1. Use `@>` (contains) operator for indexed queries
2. Extract frequently queried fields to columns if needed
3. Avoid `->` / `->>` in WHERE clause (bypasses index)

#### Statistics & Query Planning

**Problem**: PostgreSQL can't keep statistics on JSONB field values

```sql
-- PostgreSQL knows distribution of 'platform' column
EXPLAIN SELECT * FROM canonical_objects WHERE platform = 'github';
-- → Uses index, accurate row estimate

-- PostgreSQL doesn't know distribution inside JSONB
EXPLAIN SELECT * FROM canonical_objects WHERE properties @> '{"status": "open"}';
-- → May use index, but row estimate is guess
```

**Impact**: Sub-optimal query plans for complex JSONB queries

**Mitigation**: Extract high-cardinality fields to columns

### 4.4 Indexing Strategies

#### 1. GIN Index (Default)

```sql
CREATE INDEX idx_properties_gin ON canonical_objects USING GIN(properties);
```

**Use Case**: Containment queries (`@>`, `?`, `?|`, `?&`)

**Performance**: Good for key/value lookups, slower for updates

#### 2. GIN with jsonb_path_ops

```sql
CREATE INDEX idx_properties_ops ON canonical_objects
USING GIN(properties jsonb_path_ops);
```

**Use Case**: Only `@>` operator (faster, smaller index)

**Trade-off**: Can't use `?` (key exists) operator

**Recommendation for Momo**: Use `jsonb_path_ops` for `actors`, `properties` (we mostly use `@>`)

#### 3. Expression Index

```sql
CREATE INDEX idx_status ON canonical_objects
((properties->>'status'));
```

**Use Case**: Frequently query specific field

**Example**:

```sql
-- Fast with expression index
SELECT * FROM canonical_objects WHERE properties->>'status' = 'open';
```

**When to Use**: Top 3-5 most-queried JSONB fields

### 4.5 Validation & Constraints

**Problem**: JSONB = no schema enforcement

```sql
-- Both valid, even though structure differs!
INSERT INTO canonical_objects (actors) VALUES ('{"created_by": "alice"}');
INSERT INTO canonical_objects (actors) VALUES ('{"creator": "bob"}');  -- Oops, wrong key
```

**Solutions**:

#### A. Application-Level Validation (Recommended)

```typescript
import { z } from 'zod';

const ActorsSchema = z.object({
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
  assignees: z.array(z.string()).optional(),
});

function validateActors(actors: unknown): Actors {
  return ActorsSchema.parse(actors); // Throws if invalid
}
```

#### B. CHECK Constraint (Database-Level)

```sql
ALTER TABLE canonical_objects
ADD CONSTRAINT actors_has_created_by
CHECK (actors ? 'created_by');  -- Requires 'created_by' key
```

**Trade-off**: Too rigid (what if some platforms don't have `created_by`?)

#### C. Trigger-Based Validation

```sql
CREATE FUNCTION validate_actors() RETURNS TRIGGER AS $$
BEGIN
  IF NOT (NEW.actors ? 'created_by' OR NEW.actors ? 'updated_by') THEN
    RAISE EXCEPTION 'actors must have created_by or updated_by';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_actors
BEFORE INSERT OR UPDATE ON canonical_objects
FOR EACH ROW EXECUTE FUNCTION validate_actors();
```

**Momo's Choice**: Application-level validation (TypeScript + Zod) = most flexible

---

## 5. 현재 Momo Schema 분석

### 5.1 Schema Overview

```sql
CREATE TABLE canonical_objects (
  -- Identifiers
  id VARCHAR(255) PRIMARY KEY,  -- "platform|workspace|type|id"

  -- Platform metadata
  platform VARCHAR(20) NOT NULL,
  object_type VARCHAR(50) NOT NULL,

  -- Core content
  title TEXT,
  body TEXT,

  -- JSONB fields (flexible)
  attachments JSONB,
  actors JSONB NOT NULL,
  timestamps JSONB NOT NULL,
  relations JSONB,
  properties JSONB,
  summary JSONB,

  -- Search & deduplication
  search_text TEXT,
  semantic_hash VARCHAR(64),

  -- Metadata
  visibility VARCHAR(20) DEFAULT 'team',
  deleted_at TIMESTAMPTZ,
  indexed_at TIMESTAMPTZ,

  -- Raw data
  raw JSONB
);
```

### 5.2 Strengths ✅

#### 1. Clear ID Convention

```typescript
id = 'github|acme|issue|123' = 'platform|workspace|object_type|platform_id';
```

**Benefits**:

- Globally unique across all platforms
- Self-documenting (can parse to extract metadata)
- Enables cross-platform references

#### 2. Hybrid Fixed + JSONB

```
Fixed Columns: id, platform, object_type, visibility
→ Fast filtering, type safety, indexable

JSONB Columns: actors, timestamps, relations, properties
→ Platform-specific flexibility
```

**This is the sweet spot** (confirmed by PostgreSQL best practices research)

#### 3. Comprehensive Indexing

```sql
-- Platform filtering (most common)
CREATE INDEX idx_canonical_platform ON canonical_objects(platform);

-- Temporal queries
CREATE INDEX idx_canonical_created ON canonical_objects((timestamps->>'created_at'));

-- Actor searches
CREATE INDEX idx_canonical_actors ON canonical_objects USING GIN(actors);

-- Property searches
CREATE INDEX idx_canonical_properties ON canonical_objects USING GIN(properties);

-- Full-text search
CREATE INDEX idx_canonical_search ON canonical_objects
USING GIN(to_tsvector('english', COALESCE(search_text, '')));
```

**Coverage**: Covers all major query patterns

#### 4. Soft Deletes

```sql
deleted_at TIMESTAMPTZ,

-- Partial index for performance (most queries exclude deleted)
CREATE INDEX idx_canonical_deleted ON canonical_objects(deleted_at)
WHERE deleted_at IS NULL;
```

**Benefits**:

- Data recovery possible
- Audit trail preserved
- 99% of queries use partial index (faster)

#### 5. Automatic Triggers

```sql
-- Auto-update search_text from title + body
CREATE TRIGGER trigger_update_canonical_search_text ...

-- Auto-update indexed_at timestamp
CREATE TRIGGER trigger_update_canonical_indexed_at ...
```

**Benefits**: Consistency without application logic

### 5.3 Potential Improvements ⚠️

#### 1. Add Schema Version Field

```sql
ALTER TABLE canonical_objects
ADD COLUMN schema_version VARCHAR(10) DEFAULT 'v1.0';
```

**Why**: Future schema evolution tracking

#### 2. Add Workspace to Indexes

```sql
-- Extract workspace from ID for faster filtering
CREATE INDEX idx_canonical_workspace
ON canonical_objects((split_part(id, '|', 2)));
```

**Use Case**: Multi-tenant queries (filter by workspace)

#### 3. Consider Expression Indexes for Hot Paths

```sql
-- If we frequently query by status
CREATE INDEX idx_properties_status
ON canonical_objects((properties->>'status'))
WHERE properties->>'status' IS NOT NULL;

-- If we frequently query by created_by
CREATE INDEX idx_actors_created_by
ON canonical_objects((actors->>'created_by'))
WHERE actors->>'created_by' IS NOT NULL;
```

**Trade-off**: More indexes = slower writes, faster reads

**Decision**: Wait for actual query patterns before adding (YAGNI principle)

#### 4. Add Foreign Keys for Platform Types (Optional)

```sql
CREATE TABLE platforms (
  name VARCHAR(20) PRIMARY KEY,
  display_name VARCHAR(100),
  icon_url VARCHAR(500),
  enabled BOOLEAN DEFAULT true
);

ALTER TABLE canonical_objects
ADD CONSTRAINT fk_platform
FOREIGN KEY (platform) REFERENCES platforms(name);
```

**Pros**: Referential integrity, metadata about platforms
**Cons**: Less flexible (need to register platforms first)

**Decision**: Not needed for RND phase, consider for production

#### 5. Materialized View for Common Queries

```sql
CREATE MATERIALIZED VIEW mv_recent_objects AS
SELECT
  id,
  platform,
  object_type,
  title,
  actors->>'created_by' AS created_by,
  timestamps->>'created_at' AS created_at,
  properties->>'status' AS status
FROM canonical_objects
WHERE deleted_at IS NULL
  AND (timestamps->>'created_at')::timestamptz > NOW() - INTERVAL '30 days'
ORDER BY (timestamps->>'created_at')::timestamptz DESC;

CREATE INDEX idx_mv_recent_created ON mv_recent_objects(created_at);
```

**Use Case**: Dashboard queries (fast reads, refresh periodically)

**Decision**: Nice-to-have, not critical for RND

### 5.4 Schema Comparison with Research Findings

| Aspect               | Best Practice        | Momo Schema              | Status             |
| -------------------- | -------------------- | ------------------------ | ------------------ |
| **Hybrid Approach**  | Fixed + JSONB        | ✅ Uses both             | ✅ Excellent       |
| **GIN Indexes**      | On JSONB fields      | ✅ On actors, properties | ✅ Excellent       |
| **Full-Text Search** | tsvector + GIN       | ✅ Implemented           | ✅ Excellent       |
| **Soft Deletes**     | deleted_at column    | ✅ Implemented           | ✅ Excellent       |
| **Partial Indexes**  | For filtered queries | ✅ On deleted_at         | ✅ Good            |
| **Validation**       | Application-level    | ⚠️ TODO (Zod schemas)    | ⚠️ To implement    |
| **Versioning**       | Schema version field | ❌ Missing               | ⚠️ Consider adding |
| **Governance**       | Documentation        | ✅ SQL comments          | ✅ Good            |

**Overall Grade**: **A-** (Excellent foundation, minor improvements possible)

---

## 6. 개선 방안 및 의사결정

### Decision 1: Keep Hybrid JSONB Schema (No Changes)

**Rationale**:

- ✅ Research confirms this is best practice
- ✅ Notion/Airtable validation: Flexibility is key
- ✅ PostgreSQL performance: GIN indexes work well
- ✅ No need for graph DB (yet)

**Evidence**:

- Schema.org: "Favor flexibility"
- FHIR: "80/20 principle with extensions"
- PostgreSQL experts: "Hybrid pattern is sweet spot"

### Decision 2: Add Zod Validation Schemas

**Action**: Create TypeScript validation schemas for all JSONB fields

```typescript
// packages/shared/src/validation/canonical-object.ts

import { z } from 'zod';

export const AttachmentSchema = z.object({
  id: z.string(),
  type: z.enum(['pdf', 'image', 'file', 'link', 'code']),
  name: z.string(),
  url: z.string().url(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
});

export const ActorsSchema = z.object({
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
  assignees: z.array(z.string()).optional(),
  participants: z.array(z.string()).optional(),
  reviewers: z.array(z.string()).optional(),
  mentioned: z.array(z.string()).optional(),
});

export const TimestampsSchema = z.object({
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  closed_at: z.string().datetime().nullable().optional(),
  merged_at: z.string().datetime().nullable().optional(),
  deleted_at: z.string().datetime().nullable().optional(),
  start: z.string().datetime().nullable().optional(),
  end: z.string().datetime().nullable().optional(),
});

export const RelationsSchema = z
  .object({
    thread_id: z.string().optional(),
    parent_id: z.string().optional(),
    project_id: z.string().optional(),
    linked_prs: z.array(z.string()).optional(),
    linked_issues: z.array(z.string()).optional(),
  })
  .catchall(z.union([z.string(), z.array(z.string())]));

export const PropertiesSchema = z
  .object({
    labels: z.array(z.string()).optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    url: z.string().url().optional(),
    milestone: z.string().optional(),
    state: z.string().optional(),
  })
  .catchall(z.any()); // Allow platform-specific fields

export const CanonicalObjectCreateSchema = z.object({
  id: z.string().regex(/^[a-z]+\|[^|]+\|[a-z_]+\|[^|]+$/), // platform|workspace|type|id
  platform: z.string().min(1).max(20),
  object_type: z.string().min(1).max(50),
  title: z.string().optional(),
  body: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  actors: ActorsSchema,
  timestamps: TimestampsSchema,
  relations: RelationsSchema.optional(),
  properties: PropertiesSchema.optional(),
  visibility: z.enum(['private', 'team', 'public']).default('team'),
  raw: z.record(z.unknown()).optional(),
});
```

**Benefits**:

- ✅ Type safety at runtime (not just compile-time)
- ✅ Clear error messages when validation fails
- ✅ Documentation (schema = spec)
- ✅ Prevents malformed data from entering DB

### Decision 3: Document Platform-Specific Mappings

**Action**: Create mapping docs for each platform

```
docs/schemas/
├── linear-mapping.md     # Linear → CanonicalObject rules
├── zendesk-mapping.md    # Zendesk → CanonicalObject rules
└── github-mapping.md     # GitHub → CanonicalObject rules (existing)
```

**Content Template**:

```markdown
# Linear → Canonical Object Mapping

## Issue → CanonicalObject

| Linear Field  | Canonical Field       | Transformation              |
| ------------- | --------------------- | --------------------------- | ---------- | ----- | -------------------- |
| `id`          | `id`                  | `linear                     | {team.key} | issue | {identifier}`        |
| `title`       | `title`               | Direct copy                 |
| `description` | `body`                | Direct copy                 |
| `assignee.id` | `actors.assignees[]`  | `["user:{assignee.email}"]` |
| `labels`      | `properties.labels`   | Array of label names        |
| `state.name`  | `properties.status`   | Direct copy                 |
| `priority`    | `properties.priority` | Map to P0/P1/P2/P3          |
| `parent.id`   | `relations.parent_id` | `linear                     | {team}     | issue | {parent.identifier}` |
```

**Rationale**: Team can understand transformation logic without reading code

### Decision 4: Add Schema Version (Future-Proofing)

**Migration**:

```sql
-- Migration 003: Add schema version
ALTER TABLE canonical_objects
ADD COLUMN schema_version VARCHAR(10) DEFAULT 'v1.0' NOT NULL;

CREATE INDEX idx_canonical_schema_version
ON canonical_objects(schema_version);
```

**Usage**:

```typescript
// When creating objects
const obj: CreateCanonicalObjectInput = {
  id: 'linear|acme|issue|123',
  platform: 'linear',
  object_type: 'issue',
  schema_version: 'v1.0', // Explicitly set version
  // ...
};

// When querying, handle version differences
async function getCanonicalObject(id: string) {
  const obj = await db.getCanonicalObject(id);

  if (obj.schema_version === 'v0.9') {
    // Migrate on-read from old schema
    return migrateV0_9ToV1_0(obj);
  }

  return obj;
}
```

**Benefit**: Smooth schema evolution without breaking changes

### Decision 5: Stick with PostgreSQL (No Graph DB Yet)

**Rationale**:

1. **Current Needs**: Simple relationships (parent-child, project-issue)
   - PostgreSQL JSONB handles this well

2. **Query Patterns**: Mostly 1-2 hop queries
   - Example: "Get issue and its comments"
   - Example: "Get user's assigned issues"
   - Graph DB shines at 3+ hops

3. **Team Familiarity**: SQL > Cypher/Gremlin
   - Easier to hire, easier to maintain

4. **Tooling**: PostgreSQL ecosystem >> Neo4j ecosystem
   - ORMs, admin tools, monitoring

5. **Performance**: For our scale (<1M objects), PostgreSQL is faster
   - Graph DBs excel at >10M nodes with complex traversals

**When to Reconsider Graph DB**:

- ❌ Now: 100-1000 objects, simple queries
- ⚠️ Later: >100K objects, complex network queries
- ✅ Future: Recommendation engine ("similar issues based on graph")

**Decision**: PostgreSQL for now, graph DB as optional layer later

### Decision 6: Create Sync State Table

**New Migration**:

```sql
-- Migration 003: Add sync_state table
CREATE TABLE sync_state (
  platform VARCHAR(50) PRIMARY KEY,
  last_sync_time TIMESTAMPTZ NOT NULL,
  last_sync_cursor VARCHAR(500),  -- For cursor-based pagination
  method VARCHAR(20),  -- 'full' | 'incremental' | 'webhook'
  records_synced INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'idle',  -- 'idle' | 'running' | 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_state_updated ON sync_state(updated_at);

-- Auto-update updated_at
CREATE TRIGGER trigger_sync_state_updated
BEFORE UPDATE ON sync_state
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Purpose**: Track ingestion state for incremental sync (from Phase 1)

---

## 7. Summary & Next Steps

### 7.1 Key Learnings

1. **Canonical Data Models** = N² → 2N transformation complexity
2. **Hybrid Schema** (fixed + JSONB) = best practice for multi-platform
3. **PostgreSQL JSONB** ≈ Graph DB for simple relationships
4. **Validation** at application layer (Zod) > database constraints
5. **Schema Versioning** = future-proof evolution

### 7.2 Momo Schema Verdict

**Grade: A-**

**Strengths**:

- ✅ Excellent hybrid design
- ✅ Comprehensive indexing
- ✅ Soft deletes + triggers
- ✅ Follows industry best practices

**Minor Improvements**:

- ⚠️ Add Zod validation (Phase 4)
- ⚠️ Add schema_version field (Phase 4)
- ⚠️ Document platform mappings (Phase 4)
- ⚠️ Create sync_state table (Phase 6)

### 7.3 Implementation Checklist

**Phase 2 (This Phase)**:

- [x] Research canonical data models
- [x] Analyze current schema
- [x] Document findings
- [ ] Create validation schemas (move to Phase 4)

**Phase 4 (Schema Design)**:

- [ ] Write Linear mapping doc
- [ ] Write Zendesk mapping doc
- [ ] Implement Zod schemas
- [ ] Add schema_version migration

**Phase 6 (Implementation)**:

- [ ] Create sync_state table
- [ ] Implement validation in transformers
- [ ] Test with sample data

### 7.4 Open Questions for Phase 3 (Chunking)

1. **Chunk Storage**: New table or part of canonical_objects?

   ```sql
   -- Option A: Separate table
   CREATE TABLE chunks (
     id UUID PRIMARY KEY,
     canonical_object_id VARCHAR(255) REFERENCES canonical_objects(id),
     chunk_index INTEGER,
     content TEXT,
     embedding vector(1536)
   );

   -- Option B: Add to canonical_objects
   ALTER TABLE canonical_objects
   ADD COLUMN chunks JSONB;  -- Array of {content, embedding}
   ```

   **Research in Phase 3**: Which performs better for RAG queries?

2. **Embedding Dimensions**: 1536 (OpenAI) vs 1024 (Cohere) vs 384 (local)?
   - Storage impact: 1536 dims × 4 bytes = 6KB per embedding
   - Query speed: Higher dims = slower similarity search

   **Research in Phase 3**: Benchmark embedding models

3. **Chunking Granularity**: Issue-level vs Comment-level vs Sentence-level?
   - Issue-level: 1 chunk per issue (simple, but loses detail)
   - Comment-level: 1 chunk per comment (preserves context)
   - Sentence-level: Multiple chunks per comment (fine-grained, but messy)

   **Experiment in Phase 5**: Compare all three strategies

---

## References

1. [Canonical Data Models: A Comprehensive Guide (Alation)](https://www.alation.com/blog/canonical-data-models-explained-benefits-tools-getting-started/)
2. [HL7 FHIR Data Model](https://kodjin.com/blog/introduction-to-fhir-data-model/)
3. [The Data Model Behind Notion's Flexibility](https://www.notion.com/blog/data-model-behind-notion)
4. [PostgreSQL JSONB - Secret Weapon for Flexible Data Modeling](https://medium.com/@richardhightower/jsonb-postgresqls-secret-weapon-for-flexible-data-modeling-cf2f5087168f)
5. [Graph Database vs Document Database (Dataversity)](https://www.dataversity.net/articles/graph-database-vs-document-database-different-levels-of-abstraction/)
6. [When to Avoid JSONB in PostgreSQL (Heap)](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-23
**Next Review**: After Phase 4 (Schema Design)
