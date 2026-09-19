import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;
let _clientUrl: string | null = null;

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ekkveifmfrhbkfozujgm.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_GFFo7rCM0Vv8DZYCVla2mw_DsJQ1Z4A';

  if (_client && _clientUrl === url) {
    return _client;
  }

  _client = createSupabaseClient(url, key);
  _clientUrl = url;
  return _client;
}

export const supabase = createClient();
