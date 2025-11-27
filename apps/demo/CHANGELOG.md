# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Database tab with DB View and GT Graph visualization (8b8852f)
- Script to generate ground truth relations from canonical objects (61de8a8)
- Script to ingest generated JSON samples into database (2536c23)
- Consolidation stage for duplicate detection and data quality analysis (8037ee6)
- Temporal analysis stage for data freshness evaluation (500d22f)
- Graph computation and retrieval evaluation stages (e421e23)
- Experiment workflow slash commands (a18b5a0)

### Changed

- Simplified sidebar with Linear-style experiment cards (5eeee2f)
  - Removed unnecessary navigation tabs (experiment, benchmark, query interface, activity)
  - Redesigned with minimal linear-style experiment cards
  - Added time ago display and F1 score delta comparison
  - Implemented auto tab-switching when clicking experiments from database view
  - Increased sidebar width to 20rem for better content display
  - Fixed sidebar overflow issues with proper text truncation
- Consolidated database panel UI (5c9c902)
  - Moved DB/Graph/Label tabs to top-left header
  - Consolidated database stats into compact inline format
  - Removed duplicate Tabs wrapper to fix Fast Refresh loop
  - Simplified main page layout structure

### Fixed

- Ground truth generation alignment with production inference method (0cc9592)
- Sidebar experiment card overflow and text truncation (5eeee2f)
- Fast Refresh infinite loop in database panel (5c9c902)
- Unused variable warnings in page.tsx (5c9c902)

### Removed

- Unused imports from sidebar and database panel components (5eeee2f, 5c9c902)
- Unused status icon definitions (5eeee2f)
