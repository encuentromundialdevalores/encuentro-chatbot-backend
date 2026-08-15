import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface EntradaConocimiento {
  categoria: string;
  pregunta: string;
  respuesta: string;
}

let cliente: SupabaseClient | null = null;

function getCliente(): SupabaseClient | null {
  if (cliente) return cliente;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  cliente = createClient(url, key);
  return cliente;
}

// Releer Supabase en cada mensaje sería lento y sin sentido: el contenido
// cambia cada varios días, no cada segundo. Cinco minutos es un buen punto
// medio entre no castigar la base y que una corrección se vea pronto.
const TTL_MS = 5 * 60 * 1000;

let cache: { datos: EntradaConocimiento[]; expira: number } | null = null;

export async function obtenerConocimiento(): Promise<EntradaConocimiento[]> {
  if (cache && Date.now() < cache.expira) {
    return cache.datos;
  }

  const supabase = getCliente();

  if (!supabase) {
    console.warn(
      "⚠️  Supabase sin configurar: el bot va a responder que no tiene información",
    );
    return [];
  }

  const { data, error } = await supabase
    .from("conocimiento")
    .select("categoria,pregunta,respuesta")
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) {
    console.error("Error leyendo la base de conocimiento:", error.message);
    // Si Supabase falla pero tenemos datos de hace un rato, los usamos.
    // Información de hace cinco minutos es mejor que un bot mudo.
    return cache?.datos ?? [];
  }

  cache = { datos: data ?? [], expira: Date.now() + TTL_MS };
  return cache.datos;
}

export function formatearParaPrompt(entradas: EntradaConocimiento[]): string {
  if (entradas.length === 0) {
    return "(No hay información cargada todavía.)";
  }

  return entradas
    .map((e) => `[${e.categoria}]\nP: ${e.pregunta}\nR: ${e.respuesta}`)
    .join("\n\n");
}
