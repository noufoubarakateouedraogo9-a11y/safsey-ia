import { createClient } from "@supabase/supabase-js";
import { clientConfig } from "./config";

export const supabase = createClient(
  clientConfig.supabaseUrl || "https://placeholder.supabase.co",
  clientConfig.supabaseAnonKey || "placeholder",
);

export const signOut = async () => {
  await supabase.auth.signOut();
};
