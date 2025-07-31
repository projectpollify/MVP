# Module 3 Setup Instructions

## Overview
Module 3 (Groups & Content System) has been added to the repository. This document contains step-by-step instructions to get it running.

## Prerequisites
- Node.js installed
- PostgreSQL database running
- Module 1 & 2 already set up

## Setup Steps

### 1. Pull Latest Changes
```bash
git pull origin main
```

### 2. Install New Dependencies
```bash
npm install
```
This will install the new packages: axios, cheerio

### 3. Set Up Environment Variables
1. Copy `.env.example` to `.env`
2. Update with your actual values:
```
DATABASE_URL=your_actual_database_url
JWT_SECRET=generate_a_secure_secret_key
```

### 4. Run Database Migrations
```bash
# Generate Prisma client
npx prisma generate

# Run the Module 3 migration
psql -U your_db_user -d pollify_db -f src/database/migrations/003_groups_content.sql

# Or use Prisma migrate
npx prisma migrate dev --name module3_groups_content
```

### 5. Seed the Database
```bash
# Run the seed data for pillars and groups
psql -U your_db_user -d pollify_db -f src/database/seeds/003_pillars_groups.sql
```

### 6. Verify Module 2 Auth Routes
Make sure you have created `src/modules/auth/auth.routes.ts`:
```typescript
import { Router } from 'express';
// Add your auth routes here
const router = Router();
// Add login, register, verify routes
export default router;
```

### 7. Start the Server
```bash
npm run dev
```

### 8. Test the Endpoints

Test that Module 3 is working:

1. **Get all pillars:**
   ```
   GET http://localhost:3000/api/v1/pillars
   ```
   Should return 7 pillars with colors and icons

2. **Get groups in a pillar:**
   ```
   GET http://localhost:3000/api/v1/pillars/{pillar_id}/groups
   ```

3. **Health check:**
   ```
   GET http://localhost:3000/health
   ```

## File Structure Verification

Ensure these files exist:
```
pollify-mvp/
├── package.json ✓
├── .env.example ✓
├── prisma/
│   └── schema.prisma ✓
└── src/
    ├── index.ts ✓
    ├── database/
    │   ├── migrations/
    │   │   └── 003_groups_content.sql ✓
    │   └── seeds/
    │       └── 003_pillars_groups.sql ✓
    ├── modules/
    │   ├── auth/
    │   │   ├── auth.middleware.ts ✓
    │   │   └── auth.routes.ts (needs creation)
    │   └── groups/
    │       ├── groups.routes.ts ✓
    │       ├── groups.controller.ts ✓
    │       ├── groups.service.ts ✓
    │       └── sources.service.ts ✓
    └── shared/
        └── events.ts ✓
```

## Troubleshooting

### "Cannot find module" errors
- Run `npm install` again
- Check that all files are in correct locations

### Database errors
- Verify DATABASE_URL in .env
- Ensure PostgreSQL is running
- Check that Module 1 & 2 tables exist

### "Auth routes not found"
- Create the missing auth.routes.ts file
- Or temporarily comment out the auth import in index.ts

## Next Steps
Once Module 3 is running:
1. Test creating posts
2. Test joining groups
3. Verify threading works
4. Check source URL processing

## Questions?
Contact the project lead if you encounter any issues.
