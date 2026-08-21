import "dotenv/config";

import crypto from "node:crypto";

import express from "express";
import cors from "cors";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { env } from "./config/env.js";
import chatRoutes from "./routes/chat.routes.js";
import conexionRoutes from "./routes/conexion.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";

const app = express();

// Detrás del proxy de Vercel, req.ip sería siempre la IP del proxy y el
// limitador contaría a todo el mundo como un solo visitante. Con esto lee
// la IP real del X-Forwarded-For que agrega Vercel.
app.set("trust proxy", 1);

// Sin frontend propio todavía, ningún navegador tiene por qué llamarnos desde
// otro dominio. Cuando exista la web del Encuentro, se agrega su origen a
// CORS_ORIGINS separado por comas.
const origenes = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors(origenes.length > 0 ? { origin: origenes } : { origin: false }));

app.use(
  express.json({
    limit: "16kb",
    // Guardamos los bytes crudos para poder validar la firma de Meta
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf;
    },
  }),
);

const limitePorMinuto = (limit: number) =>
  rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Demasiadas peticiones, espera un minuto" },
  });

// Las plataformas externas (ManyChat y similares) llaman desde sus propios
// servidores, así que contar por IP metería a todos los usuarios en un mismo
// cupo diminuto. Cuando viene credencial, el cupo se lleva por credencial y
// es lo bastante amplio para un evento; sin ella, se limita por IP.
const limiteChat = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones, espera un minuto" },
  keyGenerator: (req) => {
    const credencial = req.get("x-api-key");

    if (credencial) {
      // Hash para no mantener la credencial en memoria del limitador
      return (
        "cred:" +
        crypto.createHash("sha256").update(credencial).digest("hex").slice(0, 16)
      );
    }

    return ipKeyGenerator(req.ip ?? "");
  },
});

app.use("/api", limiteChat, chatRoutes);
app.use(limitePorMinuto(120), webhookRoutes);
app.use(limitePorMinuto(30), conexionRoutes);

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Encuentro Chatbot API is running",
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
});

export default app;
