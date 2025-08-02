#!/bin/bash

echo "🧪 Testing Staking Module Setup..."
echo "================================"

# Check if server is running
echo -n "1. Checking if server is running... "
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ OK"
else
    echo "❌ FAILED - Start your server with: npm run dev"
    exit 1
fi

# Check health endpoint
echo -n "2. Checking health endpoint... "
HEALTH=$(curl -s http://localhost:3000/health)
if echo $HEALTH | grep -q '"staking":"active"'; then
    echo "✅ Staking module active"
else
    echo "❌ Staking module not active"
    echo "Response: $HEALTH"
fi

# Test pools endpoint
echo -n "3. Testing /api/v1/staking/pools... "
POOLS=$(curl -s http://localhost:3000/api/v1/staking/pools)
if echo $POOLS | grep -q '"success":true'; then
    POOL_COUNT=$(echo $POOLS | grep -o '"id"' | wc -l)
    echo "✅ Found $POOL_COUNT pools"
else
    echo "❌ Failed to get pools"
    echo "Response: $POOLS"
fi

# Test stats endpoint
echo -n "4. Testing /api/v1/staking/stats... "
STATS=$(curl -s http://localhost:3000/api/v1/staking/stats)
if echo $STATS | grep -q '"success":true'; then
    echo "✅ Stats endpoint working"
else
    echo "❌ Stats endpoint failed"
    echo "Response: $STATS"
fi

# Test estimate endpoint
echo -n "5. Testing /api/v1/staking/estimate... "
ESTIMATE=$(curl -s "http://localhost:3000/api/v1/staking/estimate?poolId=1&amount=100")
if echo $ESTIMATE | grep -q '"success":true'; then
    echo "✅ Estimate endpoint working"
else
    echo "❌ Estimate endpoint failed"
    echo "Response: $ESTIMATE"
fi

echo "================================"
echo "✨ Testing complete!"

# Pretty print pools if successful
if echo $POOLS | grep -q '"success":true'; then
    echo ""
    echo "📊 Available Staking Pools:"
    echo "$POOLS" | python3 -m json.tool 2>/dev/null || echo "$POOLS"
fi
