-- Email validation function to reject fake/random email patterns
-- This provides database-level validation in addition to frontend checks

-- Function to validate email patterns
CREATE OR REPLACE FUNCTION validate_email_pattern(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  local_part TEXT;
  domain_part TEXT;
  vowel_count INTEGER;
  consonant_count INTEGER;
  total_letters INTEGER;
  vowel_ratio NUMERIC;
BEGIN
  -- Basic email format check
  IF email_input !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RETURN FALSE;
  END IF;

  -- Split email into local and domain parts
  local_part := LOWER(SPLIT_PART(email_input, '@', 1));
  domain_part := LOWER(SPLIT_PART(email_input, '@', 2));

  -- Length checks
  IF LENGTH(local_part) < 3 THEN
    RETURN FALSE;
  END IF;

  -- Block pure numbers
  IF local_part ~ '^\d+$' THEN
    RETURN FALSE;
  END IF;

  -- Check for excessive character repetition (5+ same chars in a row)
  IF local_part ~ '(.)\1{4,}' THEN
    RETURN FALSE;
  END IF;

  -- Block repeating sequences (e.g., asdfasdf, jkjkjk)
  IF LENGTH(local_part) >= 8 AND local_part ~ '(.{2,})\1{1,}' THEN
    RETURN FALSE;
  END IF;

  -- Detect keyboard row patterns (qwerty, asdfgh, zxcvbnm)
  IF local_part ~ 'qwert|werty|ertyu|rtyui|tyuio|yuiop' OR
     local_part ~ 'asdfg|sdfgh|dfghj|fghjk|ghjkl' OR
     local_part ~ 'zxcvb|xcvbn|cvbnm' OR
     local_part ~ 'poiuy|oiuyt|iuytr|uytre|ytrewq' OR
     local_part ~ 'lkjhg|kjhgf|jhgfd|hgfds|gfdsa' OR
     local_part ~ 'mnbvc|nbvcx|bvcxz' THEN
    RETURN FALSE;
  END IF;

  -- Block alternating patterns (ababab, 121212, xoxoxo)
  IF local_part ~ '^(.)(.)\1\2\1\2' THEN
    RETURN FALSE;
  END IF;

  -- Count vowels and consonants
  vowel_count := LENGTH(local_part) - LENGTH(REGEXP_REPLACE(local_part, '[aeiou]', '', 'g'));
  consonant_count := LENGTH(local_part) - LENGTH(REGEXP_REPLACE(local_part, '[bcdfghjklmnpqrstvwxyz]', '', 'g'));
  total_letters := vowel_count + consonant_count;

  -- If 8+ chars and NO vowels, reject
  IF LENGTH(local_part) >= 8 AND vowel_count = 0 THEN
    RETURN FALSE;
  END IF;

  -- Check vowel ratio (less than 15% vowels is suspicious)
  IF LENGTH(local_part) >= 8 AND total_letters > 0 THEN
    vowel_ratio := vowel_count::NUMERIC / total_letters::NUMERIC;
    IF vowel_ratio < 0.15 THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Very short local part with no vowels
  IF LENGTH(local_part) <= 4 AND vowel_count = 0 THEN
    RETURN FALSE;
  END IF;

  -- All checks passed
  RETURN TRUE;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION validate_email_pattern IS 'Validates email patterns to reject fake/random emails like keyboard mashing (asdfasdf@gmail.com), repeating patterns (jkjkjk@gmail.com), excessive repetition, and low vowel ratios';

-- Example usage in a check constraint (OPTIONAL - uncomment if you want to enforce on auth.users)
-- Note: This would be added to Supabase's auth.users table
-- You may need to apply this manually in Supabase SQL Editor if needed

/*
-- Add constraint to auth.users table (OPTIONAL - BE CAREFUL with this)
ALTER TABLE auth.users 
ADD CONSTRAINT valid_email_pattern 
CHECK (validate_email_pattern(email));

-- If you need to add this to a custom users table instead:
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_email_pattern 
CHECK (validate_email_pattern(email));
*/

-- Create a trigger function to validate email on user creation
CREATE OR REPLACE FUNCTION check_email_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate email pattern
  IF NOT validate_email_pattern(NEW.email) THEN
    RAISE EXCEPTION 'Invalid email format. Please use a real email address.'
      USING HINT = 'Email patterns like keyboard mashing, repeating sequences, or random characters are not allowed.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users (if you have RLS permissions)
-- Note: You may need to run this in Supabase SQL Editor with elevated permissions
DO $$
BEGIN
  -- Check if trigger already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'validate_email_on_signup'
  ) THEN
    CREATE TRIGGER validate_email_on_signup
      BEFORE INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION check_email_on_signup();
  END IF;
END $$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION validate_email_pattern TO authenticated;
GRANT EXECUTE ON FUNCTION validate_email_pattern TO anon;

-- Test cases (you can run these to verify the function works)
-- These should return FALSE (invalid emails):
-- SELECT validate_email_pattern('asdfasdf@gmail.com');  -- repeating pattern
-- SELECT validate_email_pattern('qwertyui@gmail.com');  -- keyboard row
-- SELECT validate_email_pattern('jkjkjkjk@gmail.com');  -- alternating
-- SELECT validate_email_pattern('aaaaaaaa@gmail.com');  -- excessive repetition
-- SELECT validate_email_pattern('12345678@gmail.com');  -- all numbers
-- SELECT validate_email_pattern('zxcvbnm@gmail.com');   -- keyboard row

-- These should return TRUE (valid emails):
-- SELECT validate_email_pattern('john.doe@gmail.com');
-- SELECT validate_email_pattern('alice123@yahoo.com');
-- SELECT validate_email_pattern('bob_smith@outlook.com');
-- SELECT validate_email_pattern('mary.jane45@gmail.com');
