#!/bin/bash

# Supabase Import Script
# This script imports local database data to Supabase

# IMPORTANT: Set these variables with your Supabase connection details
# Get them from: Supabase Dashboard → Project Settings → Database → Connection pooling (Transaction mode)

SUPABASE_HOST="${SUPABASE_HOST:-aws-0-us-west-1.pooler.supabase.com}"
SUPABASE_PORT="${SUPABASE_PORT:-6543}"
SUPABASE_DB="${SUPABASE_DB:-postgres}"
SUPABASE_USER="${SUPABASE_USER:-postgres}"
SUPABASE_PASSWORD="${SUPABASE_PASSWORD}"

if [ -z "$SUPABASE_PASSWORD" ]; then
  echo "ERROR: SUPABASE_PASSWORD environment variable not set"
  echo "Please set it first: export SUPABASE_PASSWORD='your-password'"
  exit 1
fi

echo "Importing data to Supabase..."
echo "Host: $SUPABASE_HOST:$SUPABASE_PORT"
echo "Database: $SUPABASE_DB"
echo ""

# First, delete the "Week 2 Baseline" experiment that was inserted by migration
echo "1. Removing migration-inserted baseline experiment..."
PGPASSWORD=$SUPABASE_PASSWORD psql \
  -h $SUPABASE_HOST \
  -p $SUPABASE_PORT \
  -U $SUPABASE_USER \
  -d $SUPABASE_DB \
  -c "DELETE FROM experiments WHERE name = 'Week 2 Baseline';"

# Import experiments
echo "2. Importing experiments..."
PGPASSWORD=$SUPABASE_PASSWORD psql \
  -h $SUPABASE_HOST \
  -p $SUPABASE_PORT \
  -U $SUPABASE_USER \
  -d $SUPABASE_DB \
  -f data_experiments_fixed.sql

# Import canonical objects
echo "3. Importing canonical objects..."
PGPASSWORD=$SUPABASE_PASSWORD psql \
  -h $SUPABASE_HOST \
  -p $SUPABASE_PORT \
  -U $SUPABASE_USER \
  -d $SUPABASE_DB \
  -f data_canonical_objects.sql

# Import ground truth relations and chunks
echo "4. Importing ground truth relations and chunks..."
PGPASSWORD=$SUPABASE_PASSWORD psql \
  -h $SUPABASE_HOST \
  -p $SUPABASE_PORT \
  -U $SUPABASE_USER \
  -d $SUPABASE_DB \
  -f data_relations_chunks.sql

echo ""
echo "✅ Data import complete!"
echo ""
echo "Verification:"
PGPASSWORD=$SUPABASE_PASSWORD psql \
  -h $SUPABASE_HOST \
  -p $SUPABASE_PORT \
  -U $SUPABASE_USER \
  -d $SUPABASE_DB \
  -c "SELECT
    (SELECT COUNT(*) FROM experiments) as experiments,
    (SELECT COUNT(*) FROM canonical_objects) as objects,
    (SELECT COUNT(*) FROM ground_truth_relations) as relations,
    (SELECT COUNT(*) FROM chunks) as chunks;"
