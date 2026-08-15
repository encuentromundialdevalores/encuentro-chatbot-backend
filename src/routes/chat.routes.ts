import { Router } from "express";
import { generateResponse } from "../services/openai.service.js";

const router = Router();

router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      res.status(400).json({
        error: "Message is required",
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
