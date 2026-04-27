#!/bin/bash

# Deployment script for voice note and push notification fixes
# Run this script to apply all fixes in the correct order

set -e  # Exit on error

echo "🚀 Starting deployment of voice note and push notification fixes..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Backup database
echo -e "${YELLOW}Step 1: Creating database backup...${NC}"
if command -v supabase &> /dev/null; then
    supabase db dump -f backup_before_voice_fix_$(date +%Y%m%d_%H%M%S).sql
    echo -e "${GREEN}✅ Database backup created${NC}"
else
    echo -e "${YELLOW}⚠️  Supabase CLI not found. Please backup manually from dashboard.${NC}"
    read -p "Press enter to continue after backing up..."
fi
echo ""

# Step 2: Run database migration
echo -e "${YELLOW}Step 2: Running database migration...${NC}"
if command -v supabase &> /dev/null; then
    supabase db push
    echo -e "${GREEN}✅ Database migration completed${NC}"
else
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Please run the migration manually:"
    echo "1. Go to Supabase Dashboard → SQL Editor"
    echo "2. Open: supabase/migrations/20260427300000_fix_voice_notes_and_push.sql"
    echo "3. Copy and paste the content"
    echo "4. Click Run"
    read -p "Press enter after completing the migration..."
fi
echo ""

# Step 3: Deploy Edge Function
echo -e "${YELLOW}Step 3: Deploying send-push Edge Function...${NC}"
if command -v supabase &> /dev/null; then
    supabase functions deploy send-push
    echo -e "${GREEN}✅ Edge Function deployed${NC}"
else
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Please deploy the Edge Function manually:"
    echo "1. Go to Supabase Dashboard → Edge Functions"
    echo "2. Update send-push function with the new code"
    read -p "Press enter after deploying the function..."
fi
echo ""

# Step 4: Verify migration
echo -e "${YELLOW}Step 4: Verifying migration...${NC}"
echo "Please run these queries in SQL Editor to verify:"
echo ""
echo "-- Check remaining voice messages"
echo "SELECT COUNT(*) as remaining_voice_messages FROM public.messages WHERE type = 'voice';"
echo ""
echo "-- Check push_subscriptions policies"
echo "SELECT policyname FROM pg_policies WHERE tablename = 'push_subscriptions';"
echo ""
read -p "Press enter after verifying..."
echo ""

# Step 5: Optional storage cleanup
echo -e "${YELLOW}Step 5: Storage cleanup (optional)...${NC}"
echo "Do you want to clean up orphaned .webm files from storage?"
read -p "This will permanently delete old voice note files. Continue? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Please run the cleanup queries from CLEANUP_STORAGE.sql in SQL Editor"
    echo "Review the files to be deleted before running the DELETE statement"
    read -p "Press enter after cleanup..."
    echo -e "${GREEN}✅ Storage cleanup completed${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping storage cleanup${NC}"
fi
echo ""

# Step 6: Build and deploy frontend
echo -e "${YELLOW}Step 6: Building frontend...${NC}"
if [ -f "package.json" ]; then
    if command -v npm &> /dev/null; then
        npm run build
        echo -e "${GREEN}✅ Frontend built successfully${NC}"
    else
        echo -e "${RED}❌ npm not found${NC}"
        echo "Please build manually: npm run build"
    fi
else
    echo -e "${YELLOW}⚠️  package.json not found. Skipping build.${NC}"
fi
echo ""

# Step 7: Testing checklist
echo -e "${YELLOW}Step 7: Testing checklist${NC}"
echo ""
echo "Please test the following:"
echo "  [ ] Record a new voice note on mobile"
echo "  [ ] Verify it plays without errors"
echo "  [ ] Check console for: [VoiceNote] Selected MIME type: audio/mp4"
echo "  [ ] Test push notifications"
echo "  [ ] Verify no 403 or CORS errors"
echo "  [ ] Test on iOS Safari"
echo "  [ ] Test on Android Chrome"
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Deployment completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Test voice notes on mobile devices"
echo "2. Test push notifications"
echo "3. Monitor console for errors"
echo "4. Inform users about deleted voice notes"
echo ""
echo "Documentation:"
echo "  - FIX_SUMMARY.md - Complete overview"
echo "  - MIGRATION_GUIDE.md - Detailed migration steps"
echo "  - VOICE_NOTE_FIX.md - Technical details"
echo "  - VOICE_NOTE_ISSUES.md - User guide"
echo ""
echo -e "${GREEN}🎉 All fixes have been applied!${NC}"
