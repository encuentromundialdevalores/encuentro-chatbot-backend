// express.json() consume el cuerpo y solo deja el objeto ya parseado, pero la
// firma de Meta se calcula sobre los bytes originales. Guardamos una copia.
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export type Canal = "instagram" | "messenger" | "whatsapp";

// --- Lo que manda Meta ---

export interface MetaWebhookBody {
  object?: string;
  entry?: MetaEntry[];
}

export interface MetaEntry {
  id?: string;
  time?: number;
  // Instagram y Messenger usan "messaging"
  messaging?: MessagingEvent[];
  // WhatsApp usa "changes", con otra forma completamente distinta
  changes?: WhatsAppChange[];
}

export interface MessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    // true cuando el mensaje lo enviamos nosotros mismos
    is_echo?: boolean;
  };
}

export interface WhatsAppChange {
  field?: string;
  value?: {
    metadata?: { phone_number_id?: string };
    messages?: WhatsAppMessage[];
  };
}

export interface WhatsAppMessage {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
}

// --- Lo que usamos internamente, ya normalizado ---

export interface MensajeEntrante {
  canal: Canal;
  remitente: string;
  texto: string;
  // WhatsApp responde a través del número que recibió, no de "me"
  phoneNumberId?: string;
}
