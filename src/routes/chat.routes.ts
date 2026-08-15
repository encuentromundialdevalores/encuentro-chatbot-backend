import crypto from "node:crypto";

import { Router, type RequestHandler } from "express";

import { generateResponse } from "../services/openai.service.js";

const router = Router();

const MAX_MESSAGE_LENGTH = 2000;

function igualdadSegura(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);

  if (ba.length !== bb.length) return false;

  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Cada llamada a /api/chat cuesta dinero real en OpenAI. Expuesto a internet
 * sin credencial, un bot ajeno puede vaciar el saldo en horas. El webhook de
 * Meta no pasa por aquí: ese se autentica con la firma del App Secret.
 */
const requiereApiKey: RequestHandler = (req, res, next) => {
  const esperada = process.env.CHAT_API_KEY;

  if (!esperada) {
    res.status(503).json({ error: "CHAT_API_KEY no configurada en el servidor" });
    return;
  }

  const recibida = req.get("x-api-key");

  if (!recibida || !igualdadSegura(recibida, esperada)) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  next();
};

router.post("/chat", requiereApiKey, async (req, res) => {
  try {
    const { message } = req.body;

    // Verificar el tipo, no solo que venga algo: un !message deja pasar
    // arreglos y objetos, y la API de OpenAI interpreta un arreglo como
    // lista de mensajes con roles (system, assistant...). Quien llame
    // podría colar un rol de sistema y sobrescribir las instrucciones.
    if (typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({
        error: "Message is required and must be a non-empty string",
      });
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({
        error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`,
      });
      return;
    }

    const response = await generateResponse(message);

    res.json({
      response,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Error generating response",
    });
  }
});

export default router;
