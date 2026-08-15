import OpenAI from "openai";

import {
  formatearParaPrompt,
  obtenerConocimiento,
} from "./knowledge.service.js";

let client: OpenAI | null = null;

// El cliente se crea la primera vez que se usa, no al importar el módulo.
// En ESM los imports se evalúan antes del cuerpo de index.ts, así que crearlo
// aquí arriba leería OPENAI_API_KEY antes de que dotenv alcance a cargarla.
function getClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY en el archivo .env");
  }

  client = new OpenAI({ apiKey });
  return client;
}

const REGLAS = `
Eres el asistente virtual oficial del Encuentro Mundial de Valores.

Tu función es responder preguntas sobre el evento.

Reglas:
- Responde en español.
- Sé amable y claro.
- Responde ÚNICAMENTE con lo que aparece en la BASE DE CONOCIMIENTO de abajo.
- Si la respuesta no está ahí, dilo con claridad e invita a escribir a los
  organizadores. Nunca inventes fechas, precios, direcciones ni nombres.
- No menciones que existe una "base de conocimiento": habla con naturalidad.
- Responde breve, en dos o tres frases, salvo que pidan detalle.
`;

export async function generateResponse(userMessage: string): Promise<string> {
  // Los tipos de TypeScript no existen en tiempo de ejecución. Los webhooks
  // de Meta llaman a esta función con datos de fuera, así que el string se
  // valida aquí también y no solo en la ruta.
  if (typeof userMessage !== "string") {
    throw new Error("userMessage debe ser un string");
  }

  const model = process.env.OPENAI_MODEL;

  if (!model) {
    throw new Error("Falta OPENAI_MODEL en el archivo .env");
  }

  const conocimiento = await obtenerConocimiento();

  const response = await getClient().responses.create({
    model,
    instructions: `${REGLAS}\n\nBASE DE CONOCIMIENTO:\n\n${formatearParaPrompt(conocimiento)}`,
    input: userMessage,
  });

  return response.output_text;
}
