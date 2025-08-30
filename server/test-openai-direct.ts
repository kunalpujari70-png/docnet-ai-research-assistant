import { searchDocuments } from './database';
import OpenAI from 'openai';

async function testOpenAIDirect() {
  console.log('🧪 Testing OpenAI API directly...\n');
  
  const testPrompt = "What is artificial intelligence?";
  console.log(`Testing with prompt: "${testPrompt}"`);
  
  // Get document context
  const relevantDocuments = await searchDocuments(testPrompt);
  console.log(`Found ${relevantDocuments.length} relevant documents`);
  
  let databaseContext = '';
  if (relevantDocuments.length > 0) {
    console.log('Document names:', relevantDocuments.map(doc => doc.originalName).join(', '));
    const relevantSections = relevantDocuments.map(doc => {
      return `=== DOCUMENT: ${doc.originalName} ===\n${doc.content}\n`;
    });
    databaseContext = `\n\nPRIMARY SOURCE - RELEVANT DOCUMENT SECTIONS:\n${relevantSections.join('\n')}`;
    console.log('Context length:', databaseContext.length);
  }
  
  // Build system message
  const systemMessage = `You are **Claude**, the intelligent research companion powering DocNet - where documents meet the internet for extraordinary research and content creation. You excel at combining uploaded documents with web knowledge to help users discover, analyze, and create amazing content.

🚨 **CRITICAL INSTRUCTION**: If you see document content provided in the context below, you MUST use it and acknowledge it. NEVER say you couldn't find information in the documents when they are provided to you.

## **CRITICAL SOURCE ATTRIBUTION RULES:**
- **NEVER say "I couldn't find specific information in your uploaded documents" if documents are provided**
- **NEVER say "I couldn't find information in your uploaded documents" under any circumstances when documents are provided**
- **If documents are provided in the context, they contain relevant information**
- **Always acknowledge the document sources when they are available**
- **Use phrases like "Based on your uploaded documents" or "According to your documents"**
- **Only mention web search when documents don't contain the specific information needed**
- **If you see document content in the context, you MUST acknowledge it and use it**
- **The phrase "I couldn't find" should NEVER appear in your response when documents are provided**

## **Document Context:**
${relevantDocuments.length > 0 ? `You have access to ${relevantDocuments.length} uploaded document(s). Use this context to provide more relevant, specific, and insightful answers. Reference specific parts of the documents when appropriate.` : 'No documents are currently uploaded.'}`;

  // Build user message
  const userMessage = `User Question: ${testPrompt}

IMPORTANT: If document content is provided below, you MUST use it and acknowledge it. Do not say you couldn't find information in the documents.

${databaseContext}`;

  console.log('\n📤 Sending to OpenAI...');
  console.log('System message length:', systemMessage.length);
  console.log('User message length:', userMessage.length);
  console.log('Context preview:', databaseContext.substring(0, 200) + '...');
  
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || 'No response generated';
    
    console.log('\n📥 OpenAI Response:');
    console.log('='.repeat(50));
    console.log(response);
    console.log('='.repeat(50));
    
    // Check if the response contains the problematic phrase
    if (response.toLowerCase().includes("couldn't find") || response.toLowerCase().includes("could not find")) {
      console.log('\n❌ PROBLEM DETECTED: Response contains "couldn\'t find" phrase!');
    } else {
      console.log('\n✅ SUCCESS: Response does not contain problematic phrases');
    }
    
    // Check if the response acknowledges documents
    if (response.toLowerCase().includes("document") || response.toLowerCase().includes("uploaded")) {
      console.log('✅ SUCCESS: Response acknowledges documents');
    } else {
      console.log('⚠️ WARNING: Response does not mention documents');
    }
    
  } catch (error) {
    console.error('❌ OpenAI API error:', error);
  }
}

testOpenAIDirect().then(() => {
  console.log('\n✅ Direct OpenAI test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Direct OpenAI test failed:', error);
  process.exit(1);
});
