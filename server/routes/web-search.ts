import { RequestHandler } from "express";

interface WebSearchRequest {
  query: string;
  maxResults?: number;
}

interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

interface WebSearchResponse {
  results: WebSearchResult[];
  error?: string;
}

// Simple web search using DuckDuckGo Instant Answer API
export const handleWebSearch: RequestHandler = async (req, res) => {
  try {
    const { query, maxResults = 5 } = req.body as WebSearchRequest;
    
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Use DuckDuckGo Instant Answer API for web search
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();

    const results: WebSearchResult[] = [];

    // Add instant answer if available
    if (data.Abstract) {
      results.push({
        title: data.Heading || "Instant Answer",
        snippet: data.Abstract,
        url: data.AbstractURL || "",
        source: "DuckDuckGo Instant Answer"
      });
    }

    // Add related topics
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      data.RelatedTopics.slice(0, maxResults - results.length).forEach((topic: any) => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || "Related Topic",
            snippet: topic.Text,
            url: topic.FirstURL,
            source: "DuckDuckGo Related Topics"
          });
        }
      });
    }

    // If we don't have enough results, add some generic search suggestions
    if (results.length < maxResults) {
      const additionalResults = [
        {
          title: "Current Research on " + query,
          snippet: `Latest developments and research findings related to ${query}. Check recent academic papers and industry reports for the most up-to-date information.`,
          url: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
          source: "Google Scholar"
        },
        {
          title: "Industry Trends: " + query,
          snippet: `Current industry trends and market analysis for ${query}. Includes recent news, reports, and expert opinions.`,
          url: `https://www.google.com/search?q=${encodeURIComponent(query + " trends 2024")}`,
          source: "Google Search"
        }
      ];

      results.push(...additionalResults.slice(0, maxResults - results.length));
    }

    const searchResponse: WebSearchResponse = {
      results: results.slice(0, maxResults)
    };

    res.json(searchResponse);
  } catch (error) {
    console.error("Error performing web search:", error);
    res.status(500).json({ 
      error: "Internal server error during web search",
      results: []
    });
  }
};

// Enhanced search that combines multiple sources
export const handleEnhancedSearch: RequestHandler = async (req, res) => {
  try {
    const { query, includeWeb = true, includeAcademic = true } = req.body as WebSearchRequest & {
      includeWeb?: boolean;
      includeAcademic?: boolean;
    };
    
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const results: WebSearchResult[] = [];

    // Web search
    if (includeWeb) {
      try {
        const webResults = await fetch(`http://localhost:${process.env.PORT || 8080}/api/web-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, maxResults: 3 })
        });
        
        if (webResults.ok) {
          const webData = await webResults.json();
          results.push(...webData.results);
        }
      } catch (webError) {
        console.error("Web search error:", webError);
      }
    }

    // Academic search suggestions
    if (includeAcademic) {
      results.push({
        title: "Academic Research: " + query,
        snippet: `Recent academic research and peer-reviewed studies on ${query}. Includes methodology, findings, and implications.`,
        url: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
        source: "Google Scholar"
      });
    }

    const searchResponse: WebSearchResponse = {
      results: results.slice(0, 5)
    };

    res.json(searchResponse);
  } catch (error) {
    console.error("Error performing enhanced search:", error);
    res.status(500).json({ 
      error: "Internal server error during enhanced search",
      results: []
    });
  }
};
