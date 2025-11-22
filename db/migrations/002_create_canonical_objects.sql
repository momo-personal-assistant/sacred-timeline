-- =============================================================================
-- Migration 002: Create canonical_objects table
-- =============================================================================
-- This table stores unified objects from multiple platforms (GitHub, Notion, etc.)
-- in a canonical format for cross-platform search and analysis.

-- =============================================================================
-- CREATE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS canonical_objects (
  -- Identifiers
  id VARCHAR(255) PRIMARY KEY,  -- Format: "platform|workspace|type|id"

  -- Platform information
  platform VARCHAR(20) NOT NULL,  -- github, notion, slack, etc.
  object_type VARCHAR(50) NOT NULL,  -- issue, pr, page, message, commit, etc.

  -- Core content
  title TEXT,
  body TEXT,

  -- Structured data (JSONB for flexibility)

  -- Attachments: files, images, links, code snippets
  attachments JSONB,
  /*
  Example structure:
  [
    {
      "id": "att_123",
      "type": "pdf|image|file|link|code",
      "name": "design.pdf",
      "url": "https://...",
      "size": 1024000
    }
  ]
  */

  -- Actors: people involved with this object
  actors JSONB NOT NULL,
  /*
  Example structure:
  {
    "created_by": "user:alice",
    "updated_by": "user:bob",
    "assignees": ["user:carol", "user:dave"],
    "participants": ["user:alice", "user:bob", "user:carol"],
    "reviewers": ["user:eve"]
  }
  */

  -- Timestamps: temporal metadata
  timestamps JSONB NOT NULL,
  /*
  Example structure:
  {
    "created_at": "2025-11-18T10:00:00Z",
    "updated_at": "2025-11-18T12:00:00Z",
    "closed_at": null,
    "merged_at": null,
    "start": null,  // for meetings/events
    "end": null
  }
  */

  -- Relations: connections to other objects
  relations JSONB,
  /*
  Example structure:
  {
    "thread_id": "slack|thread_123",
    "parent_id": "github|issue|456",
    "project_id": "proj_mobile",
    "channel_id": "slack|channel_sales",
    "repo_id": "github|acme/repo",
    "calendar_id": "gcal|primary",
    "linked_prs": ["github|acme|pr|789"],
    "linked_issues": ["github|acme|issue|123"]
  }
  */

  -- Properties: platform-specific metadata
  properties JSONB,
  /*
  Example structure:
  {
    "labels": ["bug", "urgent"],
    "status": "open|closed|merged|done",
    "priority": "P0|P1|P2",
    "location": "Conference Room A",
    "url": "https://github.com/...",
    "milestone": "v2.0",
    "state": "open"
  }
  */

  -- Summary: LLM-generated summaries for quick understanding
  summary JSONB,
  /*
  Example structure:
  {
    "short": "Add SSO authentication support",
    "medium": "Implement single sign-on authentication using OAuth 2.0 for enterprise customers",
    "long": "This feature request involves implementing SSO authentication to allow enterprise customers to log in using their corporate credentials. The implementation should support OAuth 2.0 and SAML protocols, with priority on Microsoft Azure AD and Google Workspace integration."
  }
  */

  -- Search and deduplication
  search_text TEXT,  -- Concatenated text from title + body + comments for full-text search
  semantic_hash VARCHAR(64),  -- Hash for detecting duplicates/near-duplicates

  -- Metadata
  visibility VARCHAR(20) NOT NULL DEFAULT 'team',  -- private, team, public
  deleted_at TIMESTAMPTZ,  -- NULL if not deleted (soft delete pattern)
  indexed_at TIMESTAMPTZ,  -- Last time this object was indexed/updated

  -- Raw data preservation
  raw JSONB  -- Original API response for reference and re-processing
);

-- =============================================================================
-- CREATE INDEXES
-- =============================================================================

-- 1. Platform filtering (most common filter)
CREATE INDEX IF NOT EXISTS idx_canonical_platform
ON canonical_objects(platform);

-- 2. Creation time sorting and filtering
CREATE INDEX IF NOT EXISTS idx_canonical_created
ON canonical_objects((timestamps->>'created_at'));

-- 3. Partial index for non-deleted objects (99% of queries)
CREATE INDEX IF NOT EXISTS idx_canonical_deleted
ON canonical_objects(deleted_at)
WHERE deleted_at IS NULL;

-- 4. GIN index for actor searches (who created/updated/participated)
CREATE INDEX IF NOT EXISTS idx_canonical_actors
ON canonical_objects
USING GIN(actors);

-- 5. GIN index for property searches (labels, status, priority)
CREATE INDEX IF NOT EXISTS idx_canonical_properties
ON canonical_objects
USING GIN(properties);

-- 6. Full-text search on concatenated text
CREATE INDEX IF NOT EXISTS idx_canonical_search
ON canonical_objects
USING GIN(to_tsvector('english', COALESCE(search_text, '')));

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to automatically update search_text when title or body changes
CREATE OR REPLACE FUNCTION update_canonical_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.body, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update search_text
CREATE TRIGGER trigger_update_canonical_search_text
  BEFORE INSERT OR UPDATE OF title, body
  ON canonical_objects
  FOR EACH ROW
  EXECUTE FUNCTION update_canonical_search_text();

-- Function to auto-update indexed_at timestamp
CREATE OR REPLACE FUNCTION update_canonical_indexed_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.indexed_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update indexed_at
CREATE TRIGGER trigger_update_canonical_indexed_at
  BEFORE INSERT OR UPDATE
  ON canonical_objects
  FOR EACH ROW
  EXECUTE FUNCTION update_canonical_indexed_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE canonical_objects IS 'Unified storage for objects from multiple platforms (GitHub, Notion, Slack, etc.) in a canonical format';
COMMENT ON COLUMN canonical_objects.id IS 'Unique identifier in format: platform|workspace|type|id';
COMMENT ON COLUMN canonical_objects.platform IS 'Source platform: github, notion, slack, discord, email, etc.';
COMMENT ON COLUMN canonical_objects.object_type IS 'Type of object: issue, pr, page, message, commit, meeting, etc.';
COMMENT ON COLUMN canonical_objects.search_text IS 'Auto-generated concatenation of title and body for full-text search';
COMMENT ON COLUMN canonical_objects.semantic_hash IS 'Hash for duplicate detection and deduplication';
COMMENT ON COLUMN canonical_objects.visibility IS 'Access level: private, team, or public';
COMMENT ON COLUMN canonical_objects.deleted_at IS 'Soft delete timestamp (NULL if not deleted)';
COMMENT ON COLUMN canonical_objects.indexed_at IS 'Last indexing/update timestamp';
COMMENT ON COLUMN canonical_objects.raw IS 'Original API response from source platform';

-- =============================================================================
-- ROLLBACK (DOWN MIGRATION)
-- =============================================================================
-- To rollback this migration, run the following commands:
/*
DROP TRIGGER IF EXISTS trigger_update_canonical_indexed_at ON canonical_objects;
DROP TRIGGER IF EXISTS trigger_update_canonical_search_text ON canonical_objects;
DROP FUNCTION IF EXISTS update_canonical_indexed_at();
DROP FUNCTION IF EXISTS update_canonical_search_text();
DROP INDEX IF EXISTS idx_canonical_search;
DROP INDEX IF EXISTS idx_canonical_properties;
DROP INDEX IF EXISTS idx_canonical_actors;
DROP INDEX IF EXISTS idx_canonical_deleted;
DROP INDEX IF EXISTS idx_canonical_created;
DROP INDEX IF EXISTS idx_canonical_platform;
DROP TABLE IF EXISTS canonical_objects;
*/
