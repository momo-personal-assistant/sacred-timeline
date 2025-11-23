# Persistent Memory RAG - Demo Frontend

A web interface for testing and visualizing the Week 2 Embedding & Retrieval Layer.

## Features

- **Query Interface**: Test retrieval with natural language queries
  - View similarity scores with color coding (High/Medium/Low)
  - See matched chunks, related objects, and inferred relations
  - Real-time statistics (retrieval time, counts)

- **Validation Dashboard**: Monitor relation inference performance
  - Precision, Recall, and F1 Score metrics
  - Breakdown of True/False Positives and False Negatives
  - Multiple test scenarios (normal, sales_heavy, dev_heavy, pattern, stress)

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Update `.env` with your configuration (especially `OPENAI_API_KEY`)

3. Install dependencies:

```bash
pnpm install
```

4. Run the development server:

```bash
pnpm dev
```

5. Open [http://localhost:3001](http://localhost:3001) in your browser

## Usage

### Query Interface

1. Enter a natural language query (e.g., "authentication issues")
2. Click "Search" to retrieve relevant chunks
3. View results with similarity scores:
   - **Green (High)**: Similarity >= 40%
   - **Yellow (Medium)**: Similarity 35-40%
   - **Red (Low)**: Similarity < 35%
4. Explore related objects and their relations

### Validation Dashboard

1. Select a test scenario from the dropdown
2. View Precision, Recall, and F1 Score
3. Check the breakdown of True Positives, False Positives, and False Negatives
4. Compare ground truth total vs inferred total

## Architecture

```
apps/demo/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── query/route.ts      # Query API endpoint
│   │   │   └── validate/route.ts   # Validation API endpoint
│   │   ├── layout.tsx              # Root layout
│   │   └── page.tsx                # Main page with tabs
│   └── components/
│       ├── QueryPanel.tsx          # Query interface UI
│       └── ValidationPanel.tsx     # Validation metrics UI
├── package.json
├── tsconfig.json
└── next.config.js
```

## API Endpoints

### POST /api/query

Execute a retrieval query.

**Request:**

```json
{
  "query": "authentication issues"
}
```

**Response:**

```json
{
  "query": "authentication issues",
  "chunks": [...],
  "objects": [...],
  "relations": [...],
  "stats": {
    "total_chunks": 8,
    "total_objects": 8,
    "total_relations": 19,
    "retrieval_time_ms": 561
  }
}
```

### GET /api/validate?scenario=normal

Get validation metrics for a scenario.

**Response:**

```json
{
  "scenario": "normal",
  "precision": 0.0954,
  "recall": 0.1362,
  "f1_score": 0.1122,
  "true_positives": 29,
  "false_positives": 275,
  "false_negatives": 184,
  "ground_truth_total": 213,
  "inferred_total": 304
}
```

## Color Coding

### Similarity Scores (Query Results)

- **Green**: >= 40% (High relevance)
- **Yellow**: 35-40% (Medium relevance)
- **Red**: < 35% (Low relevance)

### Performance Metrics (Validation)

- **Green**: >= 60% (Good)
- **Yellow**: 40-60% (Fair)
- **Orange**: 20-40% (Poor)
- **Red**: < 20% (Very Poor)

## Development

The frontend uses:

- **Next.js 14** with App Router
- **React Server Components** for API routes
- **Inline styles** for simplicity (no external CSS framework)
- **TypeScript** for type safety

## Notes

- The frontend runs on port 3001 to avoid conflicts
- API routes connect directly to the database (no separate backend needed)
- All styling is inline to keep the demo simple and self-contained
- The UI is optimized for desktop browsers
