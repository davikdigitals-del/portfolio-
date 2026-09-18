# Deployment script for voice note and push notification fixes
# Run this script to apply all fixes in the correct order
# Usage: .\deploy-fixes.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting deployment of voice note and push notification fixes..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Backup database
Write-Host "Step 1: Creating database backup..." -ForegroundColor Yellow
if (Get-Command supabase -ErrorAction SilentlyContinue) {
    $backupFile = "backup_before_voice_fix_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
    supabase db dump -f $backupFile
    Write-Host "✅ Database backup created: $backupFile" -ForegroundColor Green
} else {
    Write-Host "⚠️  Supabase CLI not found. Please backup manually from dashboard." -ForegroundColor Yellow
    Read-Host "Press enter to continue after backing up"
}
Write-Host ""

# Step 2: Run database migration
Write-Host "Step 2: Running database migration..." -ForegroundColor Yellow
if (Get-Command supabase -ErrorAction SilentlyContinue) {
    supabase db push
    Write-Host "✅ Database migration completed" -ForegroundColor Green
} else {
    Write-Host "❌ Supabase CLI not found" -ForegroundColor Red
    Write-Host "Please run the migration manually:"
    Write-Host "1. Go to Supabase Dashboard → SQL Editor"
    Write-Host "2. Open: supabase/migrations/20260427300000_fix_voice_notes_and_push.sql"
    Write-Host "3. Copy and paste the content"
    Write-Host "4. Click Run"
    Read-Host "Press enter after completing the migration"
}
Write-Host ""

# Step 3: Deploy Edge Function
Write-Host "Step 3: Deploying send-push Edge Function..." -ForegroundColor Yellow
if (Get-Command supabase -ErrorAction SilentlyContinue) {
    supabase functions deploy send-push
    Write-Host "✅ Edge Function deployed" -ForegroundColor Green
} else {
    Write-Host "❌ Supabase CLI not found" -ForegroundColor Red
    Write-Host "Please deploy the Edge Function manually:"
    Write-Host "1. Go to Supabase Dashboard → Edge Functions"
    Write-Host "2. Update send-push function with the new code"
    Read-Host "Press enter after deploying the function"
}
Write-Host ""

# Step 4: Verify migration
Write-Host "Step 4: Verifying migration..." -ForegroundColor Yellow
Write-Host "Please run these queries in SQL Editor to verify:"
Write-Host ""
Write-Host "-- Check remaining voice messages"
Write-Host "SELECT COUNT(*) as remaining_voice_messages FROM public.messages WHERE type = 'voice';"
Write-Host ""
Write-Host "-- Check push_subscriptions policies"
Write-Host "SELECT policyname FROM pg_policies WHERE tablename = 'push_subscriptions';"
Write-Host ""
Read-Host "Press enter after verifying"
Write-Host ""

# Step 5: Optional storage cleanup
Write-Host "Step 5: Storage cleanup (optional)..." -ForegroundColor Yellow
$cleanup = Read-Host "Do you want to clean up orphaned .webm files from storage? This will permanently delete old voice note files. Continue? (y/N)"
if ($cleanup -eq "y" -or $cleanup -eq "Y") {
    Write-Host "Please run the cleanup queries from CLEANUP_STORAGE.sql in SQL Editor"
    Write-Host "Review the files to be deleted before running the DELETE statement"
    Read-Host "Press enter after cleanup"
    Write-Host "✅ Storage cleanup completed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Skipping storage cleanup" -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Build and deploy frontend
Write-Host "Step 6: Building frontend..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        npm run build
        Write-Host "✅ Frontend built successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ npm not found" -ForegroundColor Red
        Write-Host "Please build manually: npm run build"
    }
} else {
    Write-Host "⚠️  package.json not found. Skipping build." -ForegroundColor Yellow
}
Write-Host ""

# Step 7: Testing checklist
Write-Host "Step 7: Testing checklist" -ForegroundColor Yellow
Write-Host ""
Write-Host "Please test the following:"
Write-Host "  [ ] Record a new voice note on mobile"
Write-Host "  [ ] Verify it plays without errors"
Write-Host "  [ ] Check console for: [VoiceNote] Selected MIME type: audio/mp4"
Write-Host "  [ ] Test push notifications"
Write-Host "  [ ] Verify no 403 or CORS errors"
Write-Host "  [ ] Test on iOS Safari"
Write-Host "  [ ] Test on Android Chrome"
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Test voice notes on mobile devices"
Write-Host "2. Test push notifications"
Write-Host "3. Monitor console for errors"
Write-Host "4. Inform users about deleted voice notes"
Write-Host ""
Write-Host "Documentation:"
Write-Host "  - FIX_SUMMARY.md - Complete overview"
Write-Host "  - MIGRATION_GUIDE.md - Detailed migration steps"
Write-Host "  - VOICE_NOTE_FIX.md - Technical details"
Write-Host "  - VOICE_NOTE_ISSUES.md - User guide"
Write-Host ""
Write-Host "🎉 All fixes have been applied!" -ForegroundColor Green
