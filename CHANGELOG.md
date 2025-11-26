# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added (2025-11-24)

- Research papers management system for systematic RAG optimization
  - Database schema (migration 006) for papers table with metadata tracking
  - `/analyze-papers` slash command for parallel document analysis (supports PDF, MD, TXT, HTML, etc.)
  - `/papers-status` slash command for progress tracking
  - Automatic paper-to-experiment linking via `experiment_papers` table
  - Priority-based recommendation system for implementation order
  - Expected F1 gain tracking and ROI analysis
  - Directory structure: `docs/research/papers/sources/` (all text formats) and `summaries/`
  - Comprehensive documentation in README.md and USAGE.md
- Configuration-driven experiment system (YAML + CLI approach)
  - Database schema update (migration 007) for enhanced experiment tracking
    - Added `baseline` boolean flag for marking baseline configurations
    - Added `paper_ids` text array for linking experiments to research papers
    - Added `git_commit` varchar(40) for reproducibility tracking
    - GIN index on paper_ids for efficient paper-based queries
  - Updated ExperimentsPanel component with null-safe config rendering
    - Graceful handling of legacy experiments without config field
    - Conditional rendering for embedding, chunking, retrieval settings
    - Display of paper IDs and git commit info
  - Updated /api/experiments endpoint to return new schema fields
  - Example experiment configuration: `config/experiments/2025-11-24-hybrid-001.yaml`
    - Hybrid search testing (semantic + keyword)
    - Auto-save experiment results to database
    - Multi-scenario validation (normal, sales_heavy, dev_heavy)

### Added (2025-11-24)

- Experiments tracking system with API endpoints for CRUD operations ([9edc4d8](../../commit/9edc4d8))
  - GET /api/experiments - List all experiments with average F1 scores
  - POST /api/experiments - Create new experiment and save results
  - GET /api/experiments/[id] - Get experiment details with results
  - GET /api/experiments/compare - Compare multiple experiments
  - ExperimentsPanel component for visualizing experiment results
  - Database migration (005) for experiments and experiment_results tables
- Semantic similarity support in validation APIs ([7952eaf](../../commit/7952eaf))
  - Query parameter `?semantic=true` to enable semantic similarity
  - Average embeddings from chunks for object-level similarity
  - Combined keyword + semantic similarity scoring
- Component-wise validation API for production RAG analysis ([df58ac5](../../commit/df58ac5))
  - `/api/validate/component-wise` endpoint
  - Breaks down metrics by stage: explicit vs similarity relations
  - Per-type breakdown for detailed analysis
  - RAGAS-style evaluation framework

### Fixed (2025-11-24)

- Canonical ID normalization improving F1 score from 18% → 65.9% ([ab0649e](../../commit/ab0649e))
  - User ID format: `user:{id}` → `user|workspace|user|{id}`
  - Linear issue ID mapping during ingestion
  - Relation direction for `decided_by` relations
- Type compatibility between DB and shared packages ([9cdaf1f](../../commit/9cdaf1f), [5cb43c5](../../commit/5cb43c5))
  - Added `schema_version` field to CanonicalObject types
  - Type assertions in validation APIs for compatibility
  - Note: Full type unification pending future refactor

### Changed (2025-11-24)

- Removed debug logging from production code ([52c210e](../../commit/52c210e))
  - Removed `console.warn` from relation-inferrer
  - Fixed unused parameter warning in searchMemories
- Updated relation inferrer with semantic similarity options ([7952eaf](../../commit/7952eaf))
  - `useSemanticSimilarity` flag
  - `semanticWeight` parameter (default 0.7)
  - Lower similarity threshold (0.35) for combined scoring

### Documentation (2025-11-23)

- Added canonical ID normalization deep-dive ([df58ac5](../../commit/df58ac5))
  - Problem analysis and root cause investigation
  - Solution implementation with code examples
  - Results: 4 relations improved from 0% → 100% F1
  - Key learnings for production RAG systems
  - 462-line technical document

## Known Issues

### Build Warnings

- Pre-existing issue: `@momo/embedding/openai-embedder` module not found in query package
- Minor ESLint warnings in experiments API (any types) - to be addressed in follow-up

### Architecture Debt

- Duplicate CanonicalObject type definitions in DB and shared packages
- Type assertions used as temporary workaround
- Recommendation: Refactor DB package to import shared types

## Performance Improvements

### Week 1 Results (2025-11-23)

- Overall F1 Score: **18% → 65.9%** (+3.6x)
- Precision: ~10% → 53.5% (+5.3x)
- Recall: ~100% → 77.5% (maintained)
- Explicit Stage F1: 18% → 69.6% (+3.9x)

### Relation-Specific Improvements

- `triggered_by`: 100% → 100% (perfect)
- `resulted_in`: 0% → 100% (fixed)
- `participated_in`: 0% → 100% (fixed)
- `decided_by`: 0% → 100% (fixed)
- `created_by`: 18% → 18.6% (expected - extracting more than ground truth)
- `assigned_to`: 26% → 25.9% (expected - extracting more than ground truth)

## Security Review (2025-11-24)

### Critical Issues Identified

1. **No authentication/authorization** on API endpoints
2. **Database credentials** with fallback defaults in code
3. **SQL injection risk** in experiments compare API
4. **Type safety bypass** with `(db as any).pool`

### High Priority Issues

- No rate limiting on API routes
- Error messages exposing implementation details
- Unvalidated POST body in experiments API
- JSON.stringify on user-controlled data

### Performance Issues

- N+1 query problem in experiments listing
- No pagination on large dataset queries
- Database connection created per request (should use connection pooling)
- O(n²) similarity comparison algorithm

## Recommendations

### Immediate

1. Add authentication middleware to all API routes
2. Implement rate limiting
3. Add input validation with Zod schemas
4. Use connection pooling for database

### Short-term

1. Unify CanonicalObject type definitions
2. Address ESLint warnings in experiments API
3. Add pagination to list endpoints
4. Implement caching for frequently accessed data

### Long-term

1. Optimize similarity algorithm (O(n²) → better approach)
2. Add comprehensive error logging service
3. Implement proper secrets management
4. Add database query timeouts
