-- Add 'consolidation' to allowed layer values in layer_metrics table

-- Drop the existing constraint
ALTER TABLE layer_metrics DROP CONSTRAINT IF EXISTS layer_metrics_layer_check;

-- Add the new constraint with 'consolidation' included
ALTER TABLE layer_metrics
  ADD CONSTRAINT layer_metrics_layer_check
  CHECK (layer IN ('chunking', 'embedding', 'graph', 'retrieval', 'validation', 'temporal', 'consolidation'));
