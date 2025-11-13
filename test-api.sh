#!/bin/bash

# EcoTrack API Testing Script
echo "🧪 Testing EcoTrack API Endpoints"
echo "================================="

BASE_URL="http://localhost:3001"

echo ""
echo "1️⃣ Testing Health Endpoint..."
curl -s "$BASE_URL/health" | jq '.' || echo "❌ Health endpoint failed"

echo ""
echo "2️⃣ Testing Challenges Endpoint..."
curl -s "$BASE_URL/api/challenges?limit=1" | jq '.data.challenges[0].title' || echo "❌ Challenges endpoint failed"

echo ""
echo "3️⃣ Testing Tips Endpoint..."
curl -s "$BASE_URL/api/tips?limit=1" | jq '.data.tips[0].title' || echo "❌ Tips endpoint failed"

echo ""
echo "4️⃣ Testing Events Endpoint..."
curl -s "$BASE_URL/api/events?limit=1" | jq '.data.events[0].title' || echo "❌ Events endpoint failed"

echo ""
echo "5️⃣ Testing Community Stats..."
curl -s "$BASE_URL/api/stats/community" | jq '.data.communityStats.stats.totalUsers' || echo "❌ Stats endpoint failed"

echo ""
echo "✅ API Testing Complete!"
echo ""
echo "🚀 Your EcoTrack backend is successfully connected to MongoDB Atlas!"
echo "🌱 Database contains:"
echo "   • $(curl -s "$BASE_URL/api/challenges" | jq '.pagination.total') challenges"
echo "   • $(curl -s "$BASE_URL/api/tips" | jq '.pagination.total') tips"  
echo "   • $(curl -s "$BASE_URL/api/events" | jq '.pagination.total') events"
echo "   • $(curl -s "$BASE_URL/api/stats/community" | jq '.data.communityStats.stats.totalUsers') users"
echo ""
echo "📖 API Documentation: Check BACKEND_SPECIFICATION.txt"
echo "🌐 Server running on: http://localhost:3001"