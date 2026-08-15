import "dotenv/config";

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import chatRoutes from "./routes/chat.routes.js";
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

app.use("/api", limitePorMinuto(10), chatRoutes);
app.use(limitePorMinuto(120), webhookRoutes);

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
