-- Create a test client account for testing calls
-- Run this in Supabase SQL Editor

-- Step 1: Create a test user in auth.users
-- Note: You'll need to do this through the Supabase Dashboard UI or use the signup endpoint
-- Go to: Authentication → Users → Add User
-- Email: testclient@test.com
-- Password: test123456
-- Auto Confirm User: YES (check this box)

-- Step 2: After creating the user in the UI, get their ID and run this:
-- (Replace 'PASTE-TEST-USER-ID-HERE' with the actual UUID from the Users table)

-- Create profile for test client
INSERT INTO profiles (user_id, display_name, status)
VALUES ('PASTE-TEST-USER-ID-HERE', 'Test Client', 'offline')
ON CONFLICT (user_id) DO UPDATE 
SET display_name = 'Test Client';

-- Verify the test client was created
SELECT 
  u.id,
  u.email,
  p.display_name,
  p.status
FROM auth.users u
LEFT JOIN profiles p ON p.user_id = u.id
WHERE u.email = 'testclient@test.com';

-- ============================================
-- EASIER METHOD: Use the signup page
-- ============================================
-- Instead of SQL, just:
-- 1. Open incognito window (Ctrl+Shift+N)
-- 2. Go to your website /auth
-- 3. Sign up with: testclient@test.com / test123456
-- 4. This automatically creates the user and profile
-- 5. Now you can test calls between admin and client!
