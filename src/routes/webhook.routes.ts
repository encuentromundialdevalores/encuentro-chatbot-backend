import { Router } from "express";
import { waitUntil } from "@vercel/functions";

import { env } from "../config/env.js";
import {
  enviarMensaje,
  extraerMensajes,
  firmaValida,
} from "../services/meta.service.js";
import { generateResponse } from "../services/openai.service.js";
import type { MetaWebhookBody } from "../types/webhook.types.js";

const router = Router();

/**
 * Meta llama aquí una sola vez, cuando presionas "Verify and Save" en el panel.
 * Espera que le devolvamos el hub.challenge tal cual, en texto plano.
 */
router.get("/webhook", (req, res) => {
  const modo = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (modo === "subscribe" && token === env.metaVerifyToken()) {
    console.log("✅ Webhook verificado por Meta");
    res.status(200).type("text/plain").send(challenge);
    return;
  }

  console.warn("❌ Verificación rechazada: el verify token no coincide");
  res.sendStatus(403);
});

router.post("/webhook", (req, res) => {
  if (!firmaValida(req.rawBody, req.get("x-hub-signature-256"))) {
    // Diagnóstico temporal: sin esto, un rechazo no distingue entre "Meta no
    // mandó firma", "el cuerpo llegó vacío" y "la firma no coincide".
    console.warn("❌ Webhook rechazado. Diagnóstico:", {
      object: (req.body as MetaWebhookBody)?.object ?? "(sin object)",
      contentType: req.get("content-type") ?? "(ninguno)",
      traeFirma: Boolean(req.get("x-hub-signature-256")),
      rawBodyBytes: req.rawBody?.length ?? 0,
    });
    res.sendStatus(403);
    return;
  }

  // Meta espera un 200 en pocos segundos. Si tardamos, da el envío por fallido
  // y lo reintenta: el usuario recibiría la misma respuesta varias veces y
  // nosotros pagaríamos OpenAI cada vez. Confirmamos ya, procesamos después.
  res.sendStatus(200);

  const tarea = procesar(req.body as MetaWebhookBody).catch((error) => {
    console.error("Error procesando el webhook:", error);
  });

  // En Vercel la función puede congelarse apenas responde, y el trabajo que
  // quedó pendiente moriría a medias. waitUntil le pide a la plataforma que
  // espere. En local no hay contexto de Vercel y la promesa corre normal.
  try {
    waitUntil(tarea);
  } catch {
    // fuera de Vercel no aplica
  }
});

async function procesar(body: MetaWebhookBody): Promise<void> {
  for (const mensaje of extraerMensajes(body)) {
    console.log(`[${mensaje.canal}] ← ${mensaje.remitente}: ${mensaje.texto}`);

    try {
      const respuesta = await generateResponse(mensaje.texto);
      await enviarMensaje(mensaje, respuesta);
      console.log(`[${mensaje.canal}] → ${mensaje.remitente}: ${respuesta}`);
    } catch (error) {
      console.error(`[${mensaje.canal}] falló con ${mensaje.remitente}:`, error);
    }
  }
}

export default router;
