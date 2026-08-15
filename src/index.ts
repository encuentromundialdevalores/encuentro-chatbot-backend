import "dotenv/config";

import express from "express";
import cors from "cors";

import { env } from "./config/env.js";
import chatRoutes from "./routes/chat.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";

const app = express();

app.use(cors());

app.use(
  express.json({
    limit: "16kb",
    // Guardamos los bytes crudos para poder validar la firma de Meta
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf;
    },
  }),
);

app.use("/api", chatRoutes);
app.use(webhookRoutes);

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
