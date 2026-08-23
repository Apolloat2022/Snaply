import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Browser client — safe to use client-side. Direct-to-storage uploads rely on
// a Supabase Storage RLS policy scoping inserts to the LISTING_IMAGES_BUCKET
// (e.g. anon/authenticated insert allowed, path prefixed by session/user id).
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const LISTING_IMAGES_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "listing-images";
