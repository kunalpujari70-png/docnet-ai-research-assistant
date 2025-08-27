import { RequestHandler } from "express";

interface PdfProcessRequest {
  pdfUrl: string;
  question?: string;
}

interface PdfProcessResponse {
  content?: string;
  response?: string;
  error?: string;
}

export const handlePdfProcess: RequestHandler = async (req, res) => {
  try {
    const { pdfUrl, question } = req.body as PdfProcessRequest;
    
    if (!pdfUrl) {
      return res.status(400).json({ error: "PDF URL is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key not configured" });
    }

    // For Google Drive links, we need to convert the sharing URL to a direct download URL
    let directUrl = pdfUrl;
    if (pdfUrl.includes('drive.google.com')) {
      // Extract file ID from Google Drive URL
      const match = pdfUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        const fileId = match[1];
        // Use the correct Google Drive export URL
        directUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
      }
    }

    // Download the PDF
    let pdfResponse;
    try {
      pdfResponse = await fetch(directUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
    } catch (fetchError) {
      console.error("PDF fetch error:", fetchError);
      return res.status(400).json({
        error: "Could not download PDF. Please check the Google Drive link and ensure it's publicly accessible."
      });
    }

    if (!pdfResponse.ok) {
      console.error(`PDF download failed: ${pdfResponse.status} ${pdfResponse.statusText}`);
      return res.status(400).json({
        error: `Could not access PDF (${pdfResponse.status}). Please ensure the Google Drive link is publicly accessible.`
      });
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const base64Pdf = Buffer.from(pdfBuffer).toString('base64');

    // Prepare the prompt
    const basePrompt = question 
      ? `Please analyze this PDF document and answer the following question: ${question}`
      : "Please analyze this PDF document and provide a comprehensive summary of its contents, key points, and main themes.";

    // Call Gemini API with PDF
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: basePrompt
                },
                {
                  inline_data: {
                    mime_type: "application/pdf",
                    data: base64Pdf
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
          }
        }),
      }
    );

    let data;
    try {
      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("Gemini API error:", errorText);
        return res.status(geminiResponse.status).json({
          error: `Gemini API error: ${geminiResponse.statusText}`
        });
      }

      data = await geminiResponse.json();
    } catch (parseError) {
      console.error("Error parsing Gemini response:", parseError);
      return res.status(500).json({
        error: "Invalid response format from Gemini API"
      });
    }
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      return res.status(500).json({ 
        error: "Invalid response from Gemini API" 
      });
    }

    const aiResponse = data.candidates[0].content.parts[0].text;
    
    const result: PdfProcessResponse = {
      response: aiResponse
    };

    res.json(result);
  } catch (error) {
    console.error("Error processing PDF:", error);
    res.status(500).json({ 
      error: "Internal server error while processing PDF" 
    });
  }
};
