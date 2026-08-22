/**
 * The ONLY module allowed to import the generated Cloud client.
 * Everything else in the app goes through the functions exported by
 * /src/lib/backend/index.ts.
 */
import { supabase } from "@/integrations/supabase/client";

export const backendClient = supabase;
