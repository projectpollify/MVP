# Module 6: Staking Implementation Checklist

## Files to Replace/Modify

### 1. ✅ Environment Setup
- [ ] Create `.env` file in project root (copy the complete file provided)
- [ ] Update `.gitignore` (replace with the complete file provided)
- [ ] Fill in your actual database credentials in `.env`

### 2. ✅ Package Configuration
- [ ] Replace your `package.json` with the complete file provided
- [ ] No need to run `npm install` - you already have the dependencies!

### 3. ✅ Module Files
- [ ] Replace `src/modules/staking/services/staking.service.ts` with the complete file provided
- [ ] Replace `src/modules/staking/index.ts` with the complete file provided

### 4. ✅ Main Application
- [ ] Replace `src/index.ts` with the complete file provided

## Setup Steps

### 1. Database Migration
```bash
# Update the .env file with your database credentials first!
# Then run:
psql -U your_user -d pollify_db -f src/modules/staking/database/migrations/001_create_staking_tables.sql

# Or use the npm script:
npm run staking:migrate
```

### 2. Verify Setup
```bash
npm run staking:verify
```

### 3. Start Application
```bash
npm run dev
```

### 4. Test Endpoints
```bash
# Test that staking module is working
curl http://localhost:3000/api/v1/staking/pools

# Should return 5 staking pools
```

## Important Notes

1. **Module 4 Integration**: The staking service now uses your blockchain module's methods:
   - `getCardanoService()` - for blockchain operations
   - `getTokenRegistry()` - for token transfers

2. **Environment Variables**: Make sure to set these in your `.env`:
   - `DATABASE_URL` or individual DB settings
   - `STAKING_CONTRACT_ADDRESS` (use a test address for now)

3. **No New Dependencies**: You already have uuid and dotenv installed!

## Troubleshooting

If you get errors:

1. **"relation staking_pools does not exist"**
   - Run the migration: `npm run staking:migrate`

2. **"Cannot find module"**
   - Make sure all the staking module files were created correctly
   - Check file paths match exactly

3. **"blockchainModule.getCardanoService is not a function"**
   - Check how your Module 4 exports its functions
   - You may need to adjust the method names in staking.service.ts

## Success Indicators

✅ Server starts without errors
✅ Health check shows staking: 'active'
✅ /api/v1/staking/pools returns 5 pools
✅ No TypeScript compilation errors

## Files Modified Summary

1. `.env` - NEW FILE (create in root)
2. `.gitignore` - REPLACE entire file
3. `package.json` - REPLACE entire file  
4. `src/index.ts` - REPLACE entire file
5. `src/modules/staking/services/staking.service.ts` - REPLACE entire file
6. `src/modules/staking/index.ts` - REPLACE entire file

Total: 1 new file, 5 files to replace completely
