import crypto from "node:crypto";

import { env } from "../config/env.js";
import type {
  Canal,
  MensajeEntrante,
  MetaWebhookBody,
} from "../types/webhook.types.js";

// Messenger corta en 2000 caracteres; WhatsApp en 4096. Usamos el menor.
const LIMITE_TEXTO = 2000;

/**
 * Meta firma cada webhook con HMAC-SHA256 usando el App Secret.
 * Sin esta comprobación, cualquiera que descubra la URL puede inventarse
 * mensajes y hacernos gastar saldo de OpenAI respondiendo a nadie.
 */
function coincideConSecreto(
  rawBody: Buffer,
  firmaHeader: string,
  secreto: string,
): boolean {
  const esperada =
    "sha256=" + crypto.createHmac("sha256", secreto).update(rawBody).digest("hex");

  const recibida = Buffer.from(firmaHeader);
  const calculada = Buffer.from(esperada);

  // Longitudes distintas rompen timingSafeEqual, hay que checarlas antes
  if (recibida.length !== calculada.length) {
    return false;
  }

  return crypto.timingSafeEqual(recibida, calculada);
}

export function firmaValida(
  rawBody: Buffer | undefined,
  firmaHeader: string | undefined,
): boolean {
  if (!rawBody || !firmaHeader) {
    return false;
  }

  // Instagram con Instagram Login firma con su propio App Secret, distinto al
  // de Facebook aunque sea la misma app. Probamos ambos: los dos son secretos
  // legítimos de esta app, así que aceptar cualquiera no debilita la validación
  // (un atacante seguiría necesitando conocer uno de los dos).
  const secretos = [
    process.env.META_APP_SECRET,
    process.env.META_INSTAGRAM_APP_SECRET,
  ].filter((s): s is string => Boolean(s));

  return secretos.some((secreto) =>
    coincideConSecreto(rawBody, firmaHeader, secreto),
  );
}

function canalDe(object: string | undefined): Canal | null {
  if (object === "instagram") return "instagram";
  if (object === "page") return "messenger";
  if (object === "whatsapp_business_account") return "whatsapp";
  return null;
}

/**
 * Aplana el payload de Meta a una lista simple. Un solo webhook puede traer
 * varios mensajes de varias personas, y cada canal usa una forma distinta.
 */
export function extraerMensajes(body: MetaWebhookBody): MensajeEntrante[] {
  const canal = canalDe(body.object);

  if (!canal || !Array.isArray(body.entry)) {
    return [];
  }

  const mensajes: MensajeEntrante[] = [];

  for (const entry of body.entry) {
    // Instagram y Messenger
    for (const evento of entry.messaging ?? []) {
      // Los echos son los mensajes que nosotros mismos enviamos. Si los
      // procesáramos, el bot se respondería a sí mismo en bucle infinito.
      if (evento.message?.is_echo) continue;

      const remitente = evento.sender?.id;
      const texto = evento.message?.text;

      if (remitente && texto) {
        mensajes.push({ canal, remitente, texto });
      }
    }

    // WhatsApp
    for (const cambio of entry.changes ?? []) {
      const phoneNumberId = cambio.value?.metadata?.phone_number_id;

      for (const mensaje of cambio.value?.messages ?? []) {
        const remitente = mensaje.from;
        const texto = mensaje.text?.body;

        if (remitente && texto) {
          mensajes.push({ canal, remitente, texto, phoneNumberId });
        }
      }
    }
  }

  return mensajes;
}

/**
 * Cada canal usa un host y un tipo de token distintos:
 * - Messenger y WhatsApp: graph.facebook.com con el Page Access Token (EAA...)
 * - Instagram: graph.instagram.com con el Instagram User Access Token (IGAA...)
 *   Son credenciales de dos sistemas separados, no intercambiables entre sí.
 */
function destinoDeEnvio(destino: MensajeEntrante) {
  const version = env.metaGraphVersion();

  if (destino.canal === "whatsapp") {
    return {
      url: `https://graph.facebook.com/${version}/${destino.phoneNumberId}/messages`,
      token: env.metaAccessToken(),
    };
  }

  if (destino.canal === "instagram") {
    return {
      url: `https://graph.instagram.com/${version}/me/messages`,
      token: env.metaInstagramAccessToken(),
    };
  }

  return {
    url: `https://graph.facebook.com/${version}/me/messages`,
    token: env.metaAccessToken(),
  };
}

export async function enviarMensaje(
  destino: MensajeEntrante,
  texto: string,
): Promise<void> {
  const recorte = texto.slice(0, LIMITE_TEXTO);
  const { url, token } = destinoDeEnvio(destino);

  const cuerpo =
    destino.canal === "whatsapp"
      ? {
          messaging_product: "whatsapp",
          to: destino.remitente,
          type: "text",
          text: { body: recorte },
        }
      : {
          messaging_type: "RESPONSE",
          recipient: { id: destino.remitente },
          message: { text: recorte },
        };

  const respuesta = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cuerpo),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(
      `Meta rechazó el envío (${destino.canal}, HTTP ${respuesta.status}): ${detalle}`,
    );
  }
}
