import "dotenv/config";

function requerida(nombre: string): string {
  const valor = process.env[nombre];

  if (!valor) {
    throw new Error(`Falta ${nombre} en las variables de entorno`);
  }

  return valor;
}

// Cada variable se lee cuando se usa, no al arrancar. Así el servidor levanta
// aunque falten las credenciales de Meta, y podemos probar /health y /api/chat
// mientras se completa la configuración del panel de Facebook.
export const env = {
  port: Number(process.env.PORT ?? 3000),

  openaiApiKey: () => requerida("OPENAI_API_KEY"),
  openaiModel: () => process.env.OPENAI_MODEL ?? "gpt-5.6-luna",

  metaVerifyToken: () => requerida("META_VERIFY_TOKEN"),
  metaAccessToken: () => requerida("META_ACCESS_TOKEN"),
  metaAppSecret: () => requerida("META_APP_SECRET"),
  // v26.0 salió el 29 de julio de 2026. Cada versión vive ~2 años.
  metaGraphVersion: () => process.env.META_GRAPH_VERSION ?? "v26.0",
};
