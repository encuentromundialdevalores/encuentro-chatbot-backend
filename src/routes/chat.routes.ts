import { Router } from "express";
import { generateResponse } from "../services/openai.service.js";

const router = Router();

const MAX_MESSAGE_LENGTH = 2000;

router.post("/chat", async (req, res) => {
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
