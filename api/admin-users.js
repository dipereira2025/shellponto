import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    const url = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anon || !service) {
      return res.status(500).json({ error: "Variáveis SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY não configuradas na Vercel." });
    }

    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Sem token" });

    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const adminClient = createClient(url, service);

    const { data: authData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !authData.user) return res.status(401).json({ error: "Usuário inválido" });

    const { data: actor, error: actorErr } = await userClient
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (actorErr || !actor) return res.status(403).json({ error: "Perfil não encontrado" });
    if (!["super_admin", "manager"].includes(actor.role)) return res.status(403).json({ error: "Sem permissão" });

    const { name, email, password, store_id, shift, position, role, active } = req.body;

    if (!name || !email || !password || !store_id) {
      return res.status(400).json({ error: "Campos obrigatórios: nome, email, senha e loja" });
    }

    if (actor.role === "manager") {
      if (store_id !== actor.store_id) return res.status(403).json({ error: "Gerente só cria usuário da própria loja" });
      if (role !== "employee") return res.status(403).json({ error: "Gerente só cria funcionário" });
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (createErr) return res.status(400).json({ error: createErr.message });

    const { error: profileErr } = await adminClient.from("profiles").insert([{
      id: created.user.id,
      email,
      name,
      store_id,
      shift,
      position,
      role,
      active
    }]);

    if (profileErr) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return res.status(400).json({ error: profileErr.message });
    }

    return res.status(200).json({ ok: true, id: created.user.id });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erro interno" });
  }
}
