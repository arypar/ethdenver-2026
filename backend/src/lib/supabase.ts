import { createClient } from '@supabase/supabase-js';
import { logError } from './log.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  logError('supabase', 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY — database features disabled');
}

export const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export const DB_ENABLED = supabase !== null;
