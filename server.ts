import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Lazy-loaded Gemini AI client to avoid crashes if API key is not present initially
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images/PDFs
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  // API endpoint for analyzing logos with Gemini 3.5 Flash
  app.post("/api/gemini/analyze", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image || !mimeType) {
        return res.status(400).json({ error: "الرجاء توفير الصورة ونوع الملف بصيغة base64" });
      }

      // Check if API key is available
      if (!process.env.GEMINI_API_KEY) {
        return res.status(403).json({
          error: "مفتاح API الخاص بـ Gemini غير مهيأ. يرجى إضافته في إعدادات التطبيق (Secrets).",
          hasKey: false
        });
      }

      const ai = getGeminiClient();

      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: image,
        },
      };

      const promptPart = {
        text: `أنت خبير محترف في تصميم الشعارات وهوية العلامات التجارية. قم بتحليل هذا الشعار بعناية، ثم أرجع استجابة JSON دقيقة باللغة العربية تحتوي على الهياكل التالية فقط:
        {
          "styleName": "اسم النمط الفني للشعار (مثال: بروتالي، مينيمالي، مسطح، ثلاثي الأبعاد)",
          "shapesDescription": "تحليل الأشكال والخطوط المستخدمة في التصميم ودلالتها",
          "palette": [
            { "color": "اسم اللون باللغة العربية", "hex": "كود الـ HEX (مثال: #FF0000)" }
          ],
          "suitability": "تحليل مدى ملاءمة الشعار والقطاعات الأنسب لاستخدامه",
          "vectorPrompt": "وصف تفصيلي واحترافي للغاية باللغة الإنجليزية (English) لإعادة إنتاج الشعار بدقة عالية في مولدات الصور أو أدوات الـ Vector (مثال: Minimalist vector logo of a ... modern tech company, vector art, flat design, white background)",
          "recommendations": [
            "نصيحة لتحسين الشعار أو توظيفه بشكل احترافي"
          ]
        }
        تأكد من إرجاع JSON صالح ومطابق تماماً لهذا التنسيق دون أي نصوص إضافية أو علامات ماركداون خارج نطاق الـ JSON.`
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, promptPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              styleName: { type: Type.STRING },
              shapesDescription: { type: Type.STRING },
              palette: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    color: { type: Type.STRING },
                    hex: { type: Type.STRING }
                  },
                  required: ["color", "hex"]
                }
              },
              suitability: { type: Type.STRING },
              vectorPrompt: { type: Type.STRING },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["styleName", "shapesDescription", "palette", "suitability", "vectorPrompt", "recommendations"]
          }
        }
      });

      const responseText = response.text || "{}";
      const analysisResult = JSON.parse(responseText.trim());
      
      res.json({ success: true, analysis: analysisResult });
    } catch (error: any) {
      console.error("Gemini analysis error:", error);
      res.status(500).json({ error: error.message || "حدث خطأ أثناء تحليل الشعار الذكي." });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date() });
  });

  // Integrate Vite for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // Serve index.html for SPA fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
