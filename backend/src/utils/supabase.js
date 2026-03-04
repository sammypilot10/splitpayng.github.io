// ============================================================
// src/utils/supabase.js
// Supabase client — uses SERVICE ROLE key so it can bypass
// RLS and perform trusted server-side operations.
// NEVER expose this client or key to the frontend.
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = supabase;
