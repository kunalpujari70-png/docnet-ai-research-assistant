import { RequestHandler } from 'express';
import { searchDocuments, getAllDocuments, getDocumentById } from '../database';

interface GeminiRequest {
  prompt: string;
  context?: string;
  searchWeb?: boolean;
  templateId?: string;
  variables?: Record<string, any>;
  chatHistory?: Array<{ role: string; content: string }>;
}

interface GeminiResponse {
  response: string;
  responseTime?: number;
  sources?: string[];
  webResults?: any[];
}

export const handleGeminiChat: RequestHandler = async (req, res) => {
  try {
    const { prompt, context, searchWeb = false, templateId, variables = {}, chatHistory = [] } = req.body as GeminiRequest;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key not configured" });
    }

    // Search database for relevant documents
    let databaseContext = "";
    let relevantDocuments: any[] = []; // Initialize to avoid undefined error
    try {
      relevantDocuments = await searchDocuments(prompt);
      console.log(`Search query: "${prompt}"`);
      console.log(`Found ${relevantDocuments.length} relevant documents`);
      
      if (relevantDocuments.length > 0) {
        console.log(`Document names: ${relevantDocuments.map(doc => doc.originalName).join(', ')}`);
        databaseContext = `\n\nPRIMARY SOURCE - DOCUMENTS FROM KNOWLEDGE BASE:\n${relevantDocuments.map(doc => 
          `=== DOCUMENT: ${doc.originalName} ===\n${doc.content}\n`
        ).join('\n')}`;
      } else {
        console.log("No relevant documents found for query:", prompt);
        // Fallback: include all processed documents if search doesn't find specific matches
        const allDocuments = await getAllDocuments();
        const processedDocs = allDocuments.filter(doc => doc.processed);
        if (processedDocs.length > 0) {
          console.log("Including all processed documents as fallback");
          relevantDocuments = processedDocs; // Assign to relevantDocuments
          const fullDocs = await Promise.all(processedDocs.map(async (doc) => {
            const fullDoc = await getDocumentById(doc.id);
            return fullDoc;
          }));
          databaseContext = `\n\nFALLBACK - ALL PROCESSED DOCUMENTS:\n${fullDocs.filter(doc => doc).map(doc => 
            `=== DOCUMENT: ${doc!.originalName} ===\n${doc!.content}\n`
          ).join('\n')}`;
        }
      }
    } catch (dbError) {
      console.error("Database search error:", dbError);
    }

    // Get web search results if requested AND no relevant documents found
    let webContext = "";
    let webResults: any[] = [];
    if (searchWeb && relevantDocuments.length === 0) {
      console.log('No relevant documents found, performing web search as fallback...');
      try {
        const webResponse = await fetch(`http://localhost:${process.env.PORT || 8080}/api/web-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: prompt, maxResults: 3 })
        });
        
        if (webResponse.ok) {
          const webData = await webResponse.json();
          webResults = webData.results || [];
          if (webResults.length > 0) {
            webContext = `\n\nWEB SEARCH RESULTS (FALLBACK - NO DOCUMENTS FOUND):\n${webResults.map(result => 
              `- ${result.title}: ${result.snippet} (Source: ${result.source})`
            ).join('\n')}`;
          }
        }
      } catch (webError) {
        console.error("Web search error:", webError);
      }
    } else if (searchWeb && relevantDocuments.length > 0) {
      console.log('Relevant documents found, web search will be used as supplementary information only');
      try {
        const webResponse = await fetch(`http://localhost:${process.env.PORT || 8080}/api/web-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: prompt, maxResults: 3 })
        });
        
        if (webResponse.ok) {
          const webData = await webResponse.json();
          webResults = webData.results || [];
          if (webResults.length > 0) {
            webContext = `\n\nSUPPLEMENTARY WEB SEARCH RESULTS:\n${webResults.map(result => 
              `- ${result.title}: ${result.snippet} (Source: ${result.source})`
            ).join('\n')}`;
          }
        }
      } catch (webError) {
        console.error("Web search error:", webError);
      }
    }

    // Smart unified prompt that combines everything - DOCUMENT FIRST APPROACH
    const enhancedPrompt = `You are a comprehensive AI research assistant. Please provide a detailed, well-structured answer that PRIORITIZES the uploaded document content over web search results.

User Question: ${prompt}

CRITICAL DOCUMENT-FIRST INSTRUCTIONS:
1. ALWAYS prioritize and use information from the uploaded documents first
2. If the documents contain relevant information, base your answer primarily on that content
3. Only use web search results to supplement or add current context to the document information
4. When both documents and web results are available, lead with document content
5. Clearly indicate which information comes from documents vs. web sources
6. Extract specific quotes, data points, and insights from documents
7. Cross-reference information across multiple documents when available
4. If the documents don't contain relevant information, then use web search results
5. Provide a comprehensive, well-organized response with clear sections
6. Cite sources when possible (documents first, then web search)

${context ? `Manual Document Context: ${context}` : ''}
${databaseContext}
${webContext}

Please provide a comprehensive answer that addresses the user's question, prioritizing the uploaded document content.`;

    // Call Gemini API with enhanced configuration
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: enhancedPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini API';

    // Extract sources from documents used
    const sources = relevantDocuments?.map(doc => doc.originalName) || [];

    const result: GeminiResponse = {
      response: aiResponse,
      responseTime: Date.now(),
      sources,
      webResults
    };

    res.json(result);

  } catch (error) {
    console.error('Gemini chat error:', error);
    res.status(500).json({ 
      error: 'Gemini API error',
      response: 'I apologize, but I encountered an error with the Gemini API. Please try again or switch to a different AI provider.'
    });
  }
};

// Create router for Gemini endpoints
import express from 'express';
const router = express.Router();

router.post('/chat', handleGeminiChat);

export default router;
