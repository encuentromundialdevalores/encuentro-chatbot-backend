import { Router } from "express";

import { env } from "../config/env.js";

const router = Router();

interface CuentaConectada {
  canal: string;
  nombre: string;
  identificador: string;
  detalle?: string;
  error?: string;
}

async function cuentaInstagram(): Promise<CuentaConectada> {
  const base: CuentaConectada = {
    canal: "Instagram",
    nombre: "—",
    identificador: "—",
  };

  try {
    const token = process.env.META_INSTAGRAM_ACCESS_TOKEN;
    if (!token) return { ...base, error: "Sin token configurado" };

    const r = await fetch(
      `https://graph.instagram.com/${env.metaGraphVersion()}/me` +
        `?fields=user_id,username,name,account_type&access_token=${token}`,
    );
    const j = (await r.json()) as Record<string, any>;

    if (j.error) return { ...base, error: j.error.message };

    return {
      canal: "Instagram",
      nombre: j.name ? `${j.name} (@${j.username})` : `@${j.username}`,
      identificador: String(j.user_id ?? j.id ?? "—"),
      detalle: j.account_type ? `Cuenta ${j.account_type}` : undefined,
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Error" };
  }
}

async function cuentaMessenger(): Promise<CuentaConectada> {
  const base: CuentaConectada = {
    canal: "Facebook Messenger",
    nombre: "—",
    identificador: "—",
  };

  try {
    const token = process.env.META_ACCESS_TOKEN;
    if (!token) return { ...base, error: "Sin token configurado" };

    // Leer el nombre por /me exigiría pages_read_engagement, que no pedimos
    // porque el bot no lo necesita. debug_token confirma la conexión con el
    // mismo token y devuelve el id de la página y los permisos concedidos.
    const r = await fetch(
      `https://graph.facebook.com/${env.metaGraphVersion()}/debug_token` +
        `?input_token=${token}&access_token=${token}`,
    );
    const j = (await r.json()) as Record<string, any>;

    if (j.error) return { ...base, error: j.error.message };

    const d = j.data ?? {};
    if (!d.is_valid) return { ...base, error: "El token no es válido" };

    return {
      canal: "Facebook Messenger",
      nombre: "Encuentro Mundial de Valores",
      identificador: String(d.profile_id ?? "—"),
      detalle: `Página de Facebook · permisos: ${(d.scopes ?? []).join(", ")}`,
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Error" };
  }
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tarjeta(c: CuentaConectada): string {
  const estado = c.error
    ? `<span class="estado err">No conectada</span>`
    : `<span class="estado ok">Conectada</span>`;

  const cuerpo = c.error
    ? `<p class="error">${escapar(c.error)}</p>`
    : `<dl>
         <dt>Cuenta</dt><dd>${escapar(c.nombre)}</dd>
         <dt>Identificador</dt><dd><code>${escapar(c.identificador)}</code></dd>
         ${c.detalle ? `<dt>Tipo</dt><dd>${escapar(c.detalle)}</dd>` : ""}
       </dl>`;

  return `<article><header><h2>${escapar(c.canal)}</h2>${estado}</header>${cuerpo}</article>`;
}

/**
 * Página de estado de las cuentas conectadas.
 *
 * Existe para el App Review de Meta: la revisión pide ver la información de
 * perfil de la cuenta profesional dentro de la app, y el resto del proyecto
 * es solo API. Muestra únicamente datos de identidad públicos; nunca tokens.
 */
router.get("/conexion", async (_req, res) => {
  const [ig, fb] = await Promise.all([cuentaInstagram(), cuentaMessenger()]);

  res.type("html").send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Cuentas conectadas · Asistente del Encuentro Mundial de Valores</title>
<style>
  :root{
    --fondo:#f6f7f9; --superficie:#fff; --texto:#16181d; --suave:#5b6472;
    --borde:#e3e6ea; --ok:#0f7b3f; --okfondo:#e6f4ec; --err:#a3272b; --errfondo:#fbeaea;
  }
  @media (prefers-color-scheme:dark){
    :root{
      --fondo:#0f1115; --superficie:#171a20; --texto:#eef0f4; --suave:#98a1b0;
      --borde:#262b33; --ok:#5ad48d; --okfondo:#12301f; --err:#ff8f8f; --errfondo:#331616;
    }
  }
  *{box-sizing:border-box}
  body{
    margin:0; padding:2.5rem 1.25rem; background:var(--fondo); color:var(--texto);
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif; line-height:1.6;
  }
  main{max-width:640px;margin:0 auto}
  h1{font-size:1.4rem;margin:0 0 .25rem}
  .sub{color:var(--suave);margin:0 0 2rem;font-size:.95rem}
  article{
    background:var(--superficie); border:1px solid var(--borde);
    border-radius:12px; padding:1.25rem 1.4rem; margin-bottom:1rem;
  }
  article header{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.9rem}
  h2{font-size:1.05rem;margin:0}
  .estado{font-size:.78rem;font-weight:600;padding:.2rem .6rem;border-radius:999px;white-space:nowrap}
  .estado.ok{color:var(--ok);background:var(--okfondo)}
  .estado.err{color:var(--err);background:var(--errfondo)}
  dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:.4rem 1.25rem}
  dt{color:var(--suave);font-size:.85rem}
  dd{margin:0;word-break:break-all}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em}
  .error{margin:0;color:var(--err);font-size:.9rem}
  footer{color:var(--suave);font-size:.82rem;margin-top:2rem;text-align:center}
</style>
</head>
<body>
<main>
  <h1>Cuentas conectadas</h1>
  <p class="sub">Asistente virtual del Encuentro Mundial de Valores</p>
  ${tarjeta(ig)}
  ${tarjeta(fb)}
  <footer>Esta página solo muestra datos de identidad pública de las cuentas propias de la organización.</footer>
</main>
</body>
</html>`);
});

export default router;
