# Vercel Deployment Guide

## Overview

This guide covers deploying the Unified Memory demo app to Vercel with team access.

## Prerequisites

- Vercel account
- Database hosting (choose one):
  - **Supabase** (Recommended - supports pgvector)
  - **Neon** (Serverless PostgreSQL with pgvector)
  - **Vercel Postgres** (powered by Neon)

---

## Step 1: Database Setup

### Option A: Supabase (Recommended)

1. **Create Supabase Project:**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Note down: `Database URL`, `Host`, `Port`, `Password`

2. **Enable pgvector Extension:**

   ```sql
   -- Run in Supabase SQL Editor
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Create Database Schema:**

   ```bash
   # Use the provided migration scripts
   # TODO: Add migration command here
   ```

4. **Get Connection String:**
   - Format: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`
   - Find in: Project Settings > Database > Connection String

### Option B: Neon

1. **Create Neon Project:**
   - Go to [neon.tech](https://neon.tech)
   - Create new project
   - Enable pgvector in settings

2. **Get Connection String:**
   - Copy from Neon dashboard
   - Format: `postgresql://[user]:[password]@[host]/[database]?sslmode=require`

### Option C: Vercel Postgres

1. **Create Vercel Postgres:**
   - In Vercel dashboard > Storage > Create Database
   - Select Postgres
   - Note: Built on Neon, good Vercel integration

2. **Enable pgvector:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

---

## Step 2: Vercel Project Setup

### 2.1 Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your Git repository
4. **Root Directory:** Leave as default (will use `vercel.json` config)
5. **Framework Preset:** Next.js

### 2.2 Configure Build Settings

Vercel will automatically detect the `vercel.json` configuration:

- Build Command: `cd apps/demo && pnpm install && pnpm build`
- Output Directory: `apps/demo/.next`
- Install Command: `pnpm install`

**Manual Override (if needed):**

- Framework Preset: `Next.js`
- Root Directory: `.` (monorepo root)

---

## Step 3: Environment Variables

### Required Variables

Add these in Vercel Dashboard > Settings > Environment Variables:

#### PostgreSQL Configuration

```bash
POSTGRES_HOST=your-db-host.supabase.co
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=postgres
POSTGRES_MAX_CONNECTIONS=20
VECTOR_DIMENSIONS=1536
```

#### API Service

```bash
NODE_ENV=production
PORT=3000
API_SECRET_KEY=your-random-secret-key-here
```

#### Workspace

```bash
WORKSPACE=tenxai
```

#### Embeddings Provider (OpenAI)

```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

#### Linear Integration

```bash
LINEAR_API_KEY=lin_api_...
LINEAR_TEAM_KEY=TEN
```

#### Optional Platform APIs

```bash
# Slack (optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...

# Discord (optional)
DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...

# Notion (optional)
NOTION_API_KEY=...
NOTION_DATABASE_ID=...

# GitHub (optional)
GITHUB_TOKEN=...
```

#### Logging

```bash
LOG_LEVEL=info
```

### Supabase-Specific Variables

If using Supabase, you can also use their connection pooler:

```bash
# Direct Connection (for migrations)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# Pooled Connection (for app runtime - recommended)
POSTGRES_HOST=[HOST]-pooler.supabase.com
POSTGRES_PORT=6543
```

---

## Step 4: Deploy

### 4.1 Initial Deployment

1. Click "Deploy" in Vercel dashboard
2. Wait for build to complete
3. Vercel will provide a preview URL

### 4.2 Verify Deployment

Test these endpoints:

- Homepage: `https://your-app.vercel.app`
- Health check: `https://your-app.vercel.app/api/health` (if exists)
- Issues API: `https://your-app.vercel.app/api/momo/issues?workspace=tenxai`

### 4.3 Common Issues

**Build Fails:**

- Check build logs in Vercel dashboard
- Verify all workspace packages can build
- Check TypeScript errors

**"Dynamic server usage" Messages During Build:**

- These are **NOT errors** - they're informational messages
- API routes using `request.url` cannot be statically pre-rendered
- This is expected and correct behavior for dynamic API endpoints
- Vercel will handle these routes correctly at runtime

**Database Connection Fails:**

- Verify connection string format
- Check if Supabase/Neon allows external connections
- Verify pgvector extension is installed

**API Returns 500:**

- Check Function logs in Vercel dashboard
- Verify environment variables are set
- Check database migrations are applied

---

## Step 5: Team Access

### 5.1 Invite Team Members

1. Go to Vercel Dashboard > Settings > Members
2. Click "Invite Member"
3. Enter email addresses
4. Set role:
   - **Owner:** Full access
   - **Member:** Can deploy, view logs
   - **Viewer:** Read-only access

### 5.2 Share Preview URLs

- Production: `https://your-app.vercel.app`
- Each PR gets automatic preview deployment
- Share URLs with team via Slack/Discord

---

## Step 6: Database Migration

### Apply Schema and Seed Data

```bash
# Option 1: Manual via Supabase SQL Editor
# - Copy SQL from migration files
# - Execute in Supabase dashboard

# Option 2: Remote connection (if enabled)
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f migrations/001_initial.sql

# Option 3: Programmatic (recommended)
# TODO: Add migration script
```

---

## Step 7: Continuous Deployment

### Automatic Deployments

Vercel will automatically deploy:

- **Production:** Pushes to `main` branch
- **Preview:** Pull requests and other branches

### Manual Deployment

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

---

## Database Options Comparison

| Feature                 | Supabase                | Neon                  | Vercel Postgres          |
| ----------------------- | ----------------------- | --------------------- | ------------------------ |
| **pgvector Support**    | ✅ Yes                  | ✅ Yes                | ✅ Yes (via Neon)        |
| **Free Tier**           | 500MB, 2GB transfer     | 512MB, 3 projects     | 256MB                    |
| **Paid Pricing**        | $25/mo (Pro)            | $19/mo (Launch)       | $20/mo                   |
| **Vercel Integration**  | Manual                  | Good                  | Native                   |
| **Connection Pooling**  | ✅ Built-in             | ✅ Built-in           | ✅ Built-in              |
| **Additional Features** | Auth, Storage, Realtime | Serverless, branching | Tight Vercel integration |
| **Recommendation**      | Best for full-stack     | Best for serverless   | Best for Vercel-only     |

---

## Troubleshooting

### Build Issues

```bash
# Test build locally first
cd apps/demo
pnpm install
pnpm build

# Check for TypeScript errors
pnpm type-check
```

### Database Connection Issues

```bash
# Test connection locally
psql "your-connection-string"

# Verify pgvector
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Environment Variables

```bash
# List all required variables
cat .env.example

# Verify in Vercel
vercel env ls
```

---

## Pre-Deployment Readiness

**✅ Ready:**

- [x] Production build tested and working
- [x] vercel.json configuration created
- [x] next.config.js configured for standalone output
- [x] Deployment documentation complete

**⏳ To Do Before Deploying:**

- [ ] Choose database provider (Supabase/Neon/Vercel Postgres)
- [ ] Set up database and enable pgvector extension
- [ ] Configure environment variables in Vercel dashboard
- [ ] Run initial database migrations
- [ ] Sync Linear data to production database

---

## Post-Deployment Checklist

- [ ] Database is accessible from Vercel
- [ ] pgvector extension is installed
- [ ] All environment variables are set
- [ ] Build completes successfully
- [ ] Homepage loads
- [ ] API endpoints return data
- [ ] Team members can access
- [ ] Workspace toggle works (sample/tenxai)
- [ ] Linear data displays correctly

---

## Next Steps

1. **Set up monitoring:**
   - Use Vercel Analytics
   - Set up Sentry for error tracking

2. **Custom domain (optional):**
   - Go to Vercel > Settings > Domains
   - Add your custom domain

3. **Set up scheduled sync:**
   - Use Vercel Cron Jobs
   - Or external scheduler (GitHub Actions)

---

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
