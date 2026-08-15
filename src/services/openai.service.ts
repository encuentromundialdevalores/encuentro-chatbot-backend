import OpenAI from "openai";

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

const INSTRUCTIONS = `
Eres el asistente virtual oficial del Encuentro Mundial de Valores.

Tu función es responder preguntas sobre el evento.

Reglas:
- Responde en español.
- Sé amable y claro.
- No inventes información.
- Si no conoces una respuesta, dilo claramente.
- No afirmes información que no esté en la base de conocimiento.
`;

export async function generateResponse(userMessage: string): Promise<string> {
  const model = process.env.OPENAI_MODEL;

  if (!model) {
    throw new Error("Falta OPENAI_MODEL en el archivo .env");
  }

  const response = await getClient().responses.create({
    model,
    instructions: INSTRUCTIONS,
    input: userMessage,
  });

  return response.output_text;
}
