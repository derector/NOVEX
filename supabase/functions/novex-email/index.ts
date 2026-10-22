import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c] || c);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
  const senderName = Deno.env.get("BREVO_SENDER_NAME") || "NOVEX";
  const supportEmail = Deno.env.get("NOVEX_SUPPORT_EMAIL");
  if (!supabaseUrl || !anonKey || !brevoKey || !senderEmail || !supportEmail) {
    return json(503, { error: "Email service is not configured." });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Sign in is required." });
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.email) return json(401, { error: "Your session is invalid. Please sign in again." });

  let input: { subject?: unknown; message?: unknown };
  try { input = await req.json(); } catch { return json(400, { error: "Invalid JSON body." }); }
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (subject.length < 3 || subject.length > 120) return json(400, { error: "Subject must be 3–120 characters." });
  if (message.length < 10 || message.length > 5000) return json(400, { error: "Message must be 10–5000 characters." });

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: supportEmail }],
    replyTo: { email: user.email },
    subject: "[NOVEX] " + subject,
    textContent: "NOVEX support message\nFrom: " + user.email + "\nUser ID: " + user.id + "\n\n" + message,
    htmlContent: "<html><body><h2>NOVEX support message</h2><p><b>From:</b> " + escapeHtml(user.email) +
      "</p><p><b>User ID:</b> " + escapeHtml(user.id) + "</p><hr><p>" +
      escapeHtml(message).replace(/\n/g, "<br>") + "</p></body></html>",
  };
  const result = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "accept": "application/json", "api-key": brevoKey, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!result.ok) {
    const details = (await result.text()).slice(0, 500);
    console.error("Brevo rejected support email", result.status, details);
    return json(502, { error: "Brevo could not send the message. Check sender verification and Brevo configuration." });
  }
  const response = await result.json().catch(() => ({}));
  return json(200, { ok: true, messageId: response.messageId || null });
});
