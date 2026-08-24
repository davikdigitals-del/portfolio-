-- ============================================================
-- Email Validation SQL Function - Run in Supabase SQL Editor
-- ============================================================
-- This creates a database-level email validator to block fake
-- emails like asdfasdf@gmail.com, qwertyui@gmail.com, etc.
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute
-- ============================================================

-- Step 1: Create the validation function
CREATE OR REPLACE FUNCTION validate_email_pattern(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  local_part TEXT;
  vowel_count INTEGER;
  consonant_count INTEGER;
  total_letters INTEGER;
  vowel_ratio NUMERIC;
BEGIN
  -- Basic email format check
  IF email_input !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RETURN FALSE;
  END IF;

  -- Extract local part (before @)
  local_part := LOWER(SPLIT_PART(email_input, '@', 1));

  -- Length check
  IF LENGTH(local_part) < 3 THEN
    RETURN FALSE;
  END IF;

  -- Block pure numbers (12345678@gmail.com)
  IF local_part ~ '^\d+$' THEN
    RETURN FALSE;
  END IF;

  -- Block excessive repetition (aaaaaaaa@gmail.com)
  IF local_part ~ '(.)\1{4,}' THEN
    RETURN FALSE;
  END IF;

  -- Block repeating sequences (asdfasdf@gmail.com, jkjkjk@gmail.com)
  IF LENGTH(local_part) >= 8 AND local_part ~ '(.{2,})\1{1,}' THEN
    RETURN FALSE;
  END IF;

  -- Block keyboard row patterns
  IF local_part ~ 'qwert|werty|ertyu|rtyui|tyuio|yuiop' OR
     local_part ~ 'asdfg|sdfgh|dfghj|fghjk|ghjkl' OR
     local_part ~ 'zxcvb|xcvbn|cvbnm' OR
     local_part ~ 'poiuy|oiuyt|iuytr|uytre|ytrewq' OR
     local_part ~ 'lkjhg|kjhgf|jhgfd|hgfds|gfdsa' OR
     local_part ~ 'mnbvc|nbvcx|bvcxz' THEN
    RETURN FALSE;
  END IF;

  -- Block alternating patterns (ababab@gmail.com)
  IF local_part ~ '^(.)(.)\1\2\1\2' THEN
    RETURN FALSE;
  END IF;

  -- Count vowels and consonants
  vowel_count := LENGTH(local_part) - LENGTH(REGEXP_REPLACE(local_part, '[aeiou]', '', 'g'));
  consonant_count := LENGTH(local_part) - LENGTH(REGEXP_REPLACE(local_part, '[bcdfghjklmnpqrstvwxyz]', '', 'g'));
  total_letters := vowel_count + consonant_count;

  -- Reject if 8+ chars with NO vowels
  IF LENGTH(local_part) >= 8 AND vowel_count = 0 THEN
    RETURN FALSE;
  END IF;

  -- Reject if vowel ratio < 15% (suspicious)
  IF LENGTH(local_part) >= 8 AND total_letters > 0 THEN
    vowel_ratio := vowel_count::NUMERIC / total_letters::NUMERIC;
    IF vowel_ratio < 0.15 THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Reject short emails with no vowels
  IF LENGTH(local_part) <= 4 AND vowel_count = 0 THEN
    RETURN FALSE;
  END IF;

  -- All checks passed - email looks valid
  RETURN TRUE;
END;
$$;

-- Add helpful comment
COMMENT ON FUNCTION validate_email_pattern IS 
'Validates email patterns to block fake emails: keyboard mashing (asdfasdf@gmail.com), repeating patterns (jkjkjk@gmail.com), excessive repetition (aaaaa@gmail.com), keyboard rows (qwerty@gmail.com), and low vowel ratios';

-- Grant permissions
GRANT EXECUTE ON FUNCTION validate_email_pattern TO authenticated;
GRANT EXECUTE ON FUNCTION validate_email_pattern TO anon;

-- ============================================================
-- TEST QUERIES - Verify the function works correctly
-- ============================================================

-- Should return FALSE (invalid/fake emails):
SELECT 'asdfasdf@gmail.com' AS email, validate_email_pattern('asdfasdf@gmail.com') AS is_valid;
SELECT 'qwertyui@gmail.com' AS email, validate_email_pattern('qwertyui@gmail.com') AS is_valid;
SELECT 'jkjkjkjk@gmail.com' AS email, validate_email_pattern('jkjkjkjk@gmail.com') AS is_valid;
SELECT 'aaaaaaaa@gmail.com' AS email, validate_email_pattern('aaaaaaaa@gmail.com') AS is_valid;
SELECT '12345678@gmail.com' AS email, validate_email_pattern('12345678@gmail.com') AS is_valid;
SELECT 'zxcvbnm@gmail.com' AS email, validate_email_pattern('zxcvbnm@gmail.com') AS is_valid;

-- Should return TRUE (valid emails):
SELECT 'john.doe@gmail.com' AS email, validate_email_pattern('john.doe@gmail.com') AS is_valid;
SELECT 'alice123@yahoo.com' AS email, validate_email_pattern('alice123@yahoo.com') AS is_valid;
SELECT 'bob_smith@outlook.com' AS email, validate_email_pattern('bob_smith@outlook.com') AS is_valid;

-- ============================================================
-- OPTIONAL: Add trigger to automatically validate on signup
-- ============================================================
-- IMPORTANT: Only run this if you want automatic validation
-- This will BLOCK signups with fake emails at the database level

/*
-- Step 2: Create trigger function
CREATE OR REPLACE FUNCTION check_email_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT validate_email_pattern(NEW.email) THEN
    RAISE EXCEPTION 'Invalid email format. Please use a real email address.'
      USING HINT = 'Keyboard patterns, repeating sequences, or random characters are not allowed.';
  END IF;
  RETURN NEW;
END;
$$;

-- Step 3: Create the trigger (CAUTION: This affects user signups)
DROP TRIGGER IF EXISTS validate_email_on_signup ON auth.users;
CREATE TRIGGER validate_email_on_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION check_email_on_signup();
*/

-- ============================================================
-- HOW TO USE THIS FUNCTION IN YOUR APP
-- ============================================================

-- Option 1: Call from RPC in your app
-- supabase.rpc('validate_email_pattern', { email_input: 'test@gmail.com' })

-- Option 2: Use in SQL queries
-- SELECT * FROM users WHERE validate_email_pattern(email) = TRUE;

-- Option 3: Add as check constraint to custom tables
-- ALTER TABLE public.profiles 
-- ADD CONSTRAINT valid_email_pattern 
-- CHECK (validate_email_pattern(email));

-- ============================================================
-- DEPLOYMENT NOTES
-- ============================================================
-- ✅ Frontend validation: Already implemented in src/lib/auth.tsx
-- ✅ Database validation: Run this SQL in Supabase SQL Editor
-- ⚠️  Auth trigger: Optional - only enable if you want to enforce at DB level
--    (The trigger is commented out by default for safety)
-- ============================================================

SELECT 'Email validation function created successfully! Run the test queries above to verify.' AS status;
