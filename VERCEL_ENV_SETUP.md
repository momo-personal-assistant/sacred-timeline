# Vercel Environment Variables Setup for Supabase

## Critical: Configure These in Vercel Dashboard

Your Vercel deployment is currently using localhost defaults, which is why the API is returning 500 errors. You need to configure Supabase connection details in Vercel.

## Steps to Configure

### 1. Get Your Supabase Connection Details

Go to your Supabase project dashboard:

- Project Settings → Database → Connection String
- Look for "Connection Pooling" section (for serverless/Vercel)

You'll need:

- **Connection Mode**: Use "Transaction" mode for serverless
- **Port**: 6543 (pooler port, NOT 5432)
- **Host**: `aws-0-us-west-1.pooler.supabase.com` (or your region)

### 2. Add Environment Variables in Vercel

Go to: https://vercel.com/[your-username]/[your-project]/settings/environment-variables

Add these variables:

```
POSTGRES_HOST=aws-0-us-west-1.pooler.supabase.com
POSTGRES_PORT=6543
POSTGRES_DB=postgres
POSTGRES_USER=postgres.[your-project-ref]
POSTGRES_PASSWORD=[your-database-password]
POSTGRES_MAX_CONNECTIONS=20
VECTOR_DIMENSIONS=1536
OPENAI_API_KEY=[your-openai-key]
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
NODE_ENV=production
```

**Important Notes:**

- ✅ Use port **6543** (Transaction pooler) for Vercel serverless
- ❌ Don't use port 5432 (direct connection doesn't work in serverless)
- The database name is typically `postgres` for Supabase
- The user format is `postgres.[project-ref]` or just `postgres`

### 3. Find Your Exact Values

In Supabase Dashboard:

**Method 1: Use Connection String**

1. Go to Project Settings → Database
2. Copy the "Connection pooling" string (Transaction mode)
3. Extract values from: `postgresql://[user]:[password]@[host]:[port]/[database]`

**Method 2: Manual Values**

1. **POSTGRES_HOST**: Found in connection string or Database Settings
2. **POSTGRES_PORT**: `6543` (always use pooler for Vercel)
3. **POSTGRES_DB**: Usually `postgres`
4. **POSTGRES_USER**: Usually `postgres.[project-ref]` or just `postgres`
5. **POSTGRES_PASSWORD**: The password you set during project creation

### 4. Apply to All Environments

When adding each variable in Vercel:

- ✅ Check "Production"
- ✅ Check "Preview"
- ✅ Check "Development"

### 5. Trigger Redeployment

After adding all environment variables:

1. Go to Deployments tab
2. Click "..." menu on latest deployment
3. Click "Redeploy"
4. Select "Use existing Build Cache" (faster)
5. Click "Redeploy"

## Quick Check

After redeployment, your app should:

- ✅ Show "Week 2 Baseline" experiment in Experiments tab
- ✅ Load Database tab without "Failed to fetch database data" error
- ✅ Display canonical objects and ground truth relations

## Troubleshooting

If errors persist:

### Check Vercel Logs

1. Go to Deployments → Latest deployment
2. Click "View Function Logs"
3. Look for SQL errors or connection errors

### Common Errors

**"password authentication failed"**

- Wrong POSTGRES_PASSWORD
- Wrong POSTGRES_USER format

**"timeout"**

- Using port 5432 instead of 6543
- Wrong POSTGRES_HOST

**"column does not exist"**

- ✅ Already fixed! The `archived` column bug is resolved

### Verify Environment Variables

```bash
# In Vercel Function Logs, you should see successful connections, not:
# "connecting to localhost:5434" ❌
#
# You should see:
# "connecting to aws-0-us-west-1.pooler.supabase.com:6543" ✅
```

## Code Fix Applied

✅ Fixed: Removed references to non-existent `archived` column in experiments table

- File: `apps/demo/src/app/api/experiments/route.ts`
- Lines 82, 68, 118

The code now matches your actual database schema.
