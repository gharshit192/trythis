#!/bin/bash

# Notification Testing Script
# Usage: ./test-notification.sh <YOUR_AUTH_TOKEN> [day] [hour]
#
# Examples:
#   ./test-notification.sh abc123def456         (defaults to Friday 6pm)
#   ./test-notification.sh abc123def456 5 18    (Friday 6pm explicit)
#   ./test-notification.sh abc123def456 6 10    (Saturday 10am)
#   ./test-notification.sh abc123def456 0 19    (Sunday 7pm)

set -e

if [ $# -lt 1 ]; then
  echo "❌ Missing auth token"
  echo ""
  echo "Usage: $0 <AUTH_TOKEN> [dayOfWeek] [hour]"
  echo ""
  echo "Examples:"
  echo "  $0 YOUR_TOKEN                    # Friday 6pm (default)"
  echo "  $0 YOUR_TOKEN 5 18               # Friday 6pm (explicit)"
  echo "  $0 YOUR_TOKEN 6 10               # Saturday 10am"
  echo "  $0 YOUR_TOKEN 0 19               # Sunday 7pm"
  echo ""
  echo "Day of week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday"
  echo "Hour: 0-23 (24-hour format)"
  exit 1
fi

AUTH_TOKEN=$1
DAY=${2:-5}              # Default to Friday (5)
HOUR=${3:-18}            # Default to 6pm (18:00)
API_URL="http://localhost:4000"

# Map day number to day name
case $DAY in
  0) DAY_NAME="Sunday" ;;
  1) DAY_NAME="Monday" ;;
  2) DAY_NAME="Tuesday" ;;
  3) DAY_NAME="Wednesday" ;;
  4) DAY_NAME="Thursday" ;;
  5) DAY_NAME="Friday" ;;
  6) DAY_NAME="Saturday" ;;
  *) echo "❌ Invalid day: $DAY (must be 0-6)"; exit 1 ;;
esac

TIME_STR=$(printf "%02d:00" $HOUR)

echo "🔔 Testing Notification Trigger"
echo "================================"
echo "Day:  $DAY_NAME ($DAY)"
echo "Time: $TIME_STR"
echo ""
echo "Sending request to: $API_URL/notifications/test/time"
echo ""

# Send request
RESPONSE=$(curl -s -X POST "$API_URL/notifications/test/time" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"dayOfWeek\": $DAY,
    \"hour\": $HOUR
  }")

# Check if response is valid JSON
if ! echo "$RESPONSE" | jq . > /dev/null 2>&1; then
  echo "❌ Invalid response from server:"
  echo "$RESPONSE"
  exit 1
fi

# Extract status
STATUS=$(echo "$RESPONSE" | jq -r '.status')

if [ "$STATUS" != "success" ]; then
  echo "❌ Request failed:"
  echo "$RESPONSE" | jq .
  exit 1
fi

# Extract created count
COUNT=$(echo "$RESPONSE" | jq '.data.created.count')

echo "✅ Success!"
echo ""
echo "📊 Results:"
echo "  Notifications created: $COUNT"
echo ""

if [ "$COUNT" -gt 0 ]; then
  echo "📋 Notifications:"
  echo "$RESPONSE" | jq '.data.created.notifications[] | {
    type: .type,
    title: .title,
    message: .message,
    priority: .priority,
    relevanceScore: .relevanceScore
  }' | jq -r '.[] | "  ✓ \(.type)\n    Title: \(.title)\n    Message: \(.message)\n    Score: \(.relevanceScore)"'
else
  echo "⚠️  No notifications created for this time/scenario."
  echo "   This could mean:"
  echo "   - No saves in matching categories"
  echo "   - Trigger conditions not met"
  echo "   - User saves already visited"
fi

echo ""
echo "💡 Tip: View all notifications with:"
echo "   curl -H 'Authorization: Bearer $AUTH_TOKEN' http://localhost:4000/notifications | jq ."
