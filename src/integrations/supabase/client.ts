import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Primary: build-time env vars (Render injects these during npm run build)
// Fallback: hardcoded values so the app always works even if env vars are missing
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  'https://gcckwqkzjoxraikosash.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjY2t3cWt6am94cmFpa29zYXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzA4MzQsImV4cCI6MjA5Mjc0NjgzNH0.BCjatcjeUane_yN9IAyI3iNdyyesq85pevZSH9LO-6E';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
