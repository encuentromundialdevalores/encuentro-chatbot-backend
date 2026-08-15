import "dotenv/config";

import express from "express";
import cors from "cors";

import chatRoutes from "./routes/chat.routes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "16kb" }));

app.use("/api", chatRoutes);

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
