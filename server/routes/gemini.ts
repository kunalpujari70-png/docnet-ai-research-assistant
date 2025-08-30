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

    // Search database for relevant documents with improved search
    let databaseContext = "";
    let relevantDocuments: any[] = []; // Initialize to avoid undefined error
    try {
      relevantDocuments = await searchDocuments(prompt);
      console.log(`Search query: "${prompt}"`);
      console.log(`Found ${relevantDocuments.length} relevant documents`);
      
      // If no documents found with exact search, try a broader search
      if (relevantDocuments.length === 0) {
        console.log("No exact matches found, trying broader search...");
        const allDocuments = await getAllDocuments();
        const processedDocs = allDocuments.filter(doc => doc.processed);
        
        if (processedDocs.length > 0) {
          // Get full content for all processed documents
          const fullDocs = await Promise.all(processedDocs.map(async (doc) => {
            const fullDoc = await getDocumentById(doc.id);
            return fullDoc;
          }));
          
          // Filter documents that contain any part of the query
          const queryWords = prompt.toLowerCase().split(/\s+/).filter(word => word.length > 2);
          relevantDocuments = fullDocs.filter(doc => 
            doc && queryWords.some(word => 
              doc.content.toLowerCase().includes(word) ||
              doc.originalName.toLowerCase().includes(word)
            )
          ).map(doc => ({
            id: doc!.id,
            originalName: doc!.originalName,
            content: doc!.content,
            summary: doc!.summary,
            uploadDate: doc!.uploadDate
          }));
          
          console.log(`Broad search found ${relevantDocuments.length} potentially relevant documents`);
        }
      }
      
      if (relevantDocuments.length > 0) {
        console.log(`Document names: ${relevantDocuments.map(doc => doc.originalName).join(', ')}`);
        databaseContext = `\n\nPRIMARY SOURCE - DOCUMENTS FROM KNOWLEDGE BASE:\n${relevantDocuments.map(doc => 
          `=== DOCUMENT: ${doc.originalName} ===\n${doc.content}\n`
        ).join('\n')}`;
      } else {
        console.log("No relevant documents found for query:", prompt);
        // Final fallback: include all processed documents if search doesn't find specific matches
        const allDocuments = await getAllDocuments();
        const processedDocs = allDocuments.filter(doc => doc.processed);
        if (processedDocs.length > 0) {
          console.log("Including all processed documents as final fallback");
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

🚨 **CRITICAL INSTRUCTION**: If you see document content provided in the context below, you MUST use it and acknowledge it. NEVER say you couldn't find information in the documents when they are provided to you.

User Question: ${prompt}

CRITICAL DOCUMENT-FIRST INSTRUCTIONS:
1. ALWAYS prioritize and use information from the uploaded documents first
2. If the documents contain relevant information, base your answer primarily on that content
3. Only use web search results to supplement or add current context to the document information
4. When both documents and web results are available, lead with document content
5. Clearly indicate which information comes from documents vs. web sources
6. Extract specific quotes, data points, and insights from documents
7. Cross-reference information across multiple documents when available
8. If the documents don't contain relevant information, then use web search results
9. Provide a comprehensive, well-organized response with clear sections
10. Cite sources when possible (documents first, then web search)

CRITICAL SOURCE ATTRIBUTION RULES:
- NEVER say "I couldn't find specific information in your uploaded documents" if documents are provided
- NEVER say "I couldn't find information in your uploaded documents" under any circumstances when documents are provided
- If documents are provided in the context, they contain relevant information
- Always acknowledge the document sources when they are available
- Use phrases like "Based on your uploaded documents" or "According to your documents"
- Only mention web search when documents don't contain the specific information needed
- If you see document content in the context, you MUST acknowledge it and use it
- The phrase "I couldn't find" should NEVER appear in your response when documents are provided

${context ? `Manual Document Context: ${context}` : ''}
${databaseContext}
${webContext}

IMPORTANT: If document content is provided above, you MUST use it and acknowledge it. Do not say you couldn't find information in the documents.

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
