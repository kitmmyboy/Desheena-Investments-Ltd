import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  const { method } = req;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  // Basic CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };

  if (method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    if (method === "GET") {
      const { data: { users }, error } = await supabase.auth.admin.listUsers();
      if (error) throw error;
      // Filter for system-managed users if needed, or just return all
      return new Response(JSON.stringify({ users }), { headers });
    }

    if (method === "POST") {
      const { email, password, full_name, phone, role } = await req.json();
      const { data: { user }, error } = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: { full_name, phone, role },
        email_confirm: true
      });
      if (error) throw error;
      return new Response(JSON.stringify({ user }), { headers });
    }

    if (method === "PUT") {
      const { id: userId, email, full_name, phone, role, password } = await req.json();
      const targetId = userId || id;
      if (!targetId) throw new Error("User ID is required for updates");

      const updateData: any = {
        email,
        user_metadata: { full_name, phone, role }
      };
      if (password) updateData.password = password;
      
      const { data: { user }, error } = await supabase.auth.admin.updateUserById(targetId, updateData);
      if (error) throw error;
      return new Response(JSON.stringify({ user }), { headers });
    }

    if (method === "DELETE") {
      if (!id) throw new Error("ID required");
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response("Method not allowed", { status: 405, headers });
  } catch (err: any) {
    const message = err?.message ?? String(err);
    const stack = err?.stack ? String(err.stack) : null;
    return new Response(JSON.stringify({ error: message, stack }), { status: 400, headers });
  }
});
