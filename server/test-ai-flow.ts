import { searchDocuments, getAllDocuments, getDocumentById } from './database';

async function testAIFlow() {
  console.log('🧪 Testing AI route flow...\n');
  
  const testPrompt = "What is artificial intelligence?";
  console.log(`Testing with prompt: "${testPrompt}"`);
  
  // Step 1: Initial search
  console.log('\n1️⃣ Initial search:');
  let relevantDocuments = await searchDocuments(testPrompt);
  console.log(`Found ${relevantDocuments.length} relevant documents`);
  
  if (relevantDocuments.length > 0) {
    console.log('Document names:', relevantDocuments.map(doc => doc.originalName).join(', '));
    console.log('First document content preview:', relevantDocuments[0].content.substring(0, 100) + '...');
  }
  
  // Step 2: Broader search if needed
  if (relevantDocuments.length === 0) {
    console.log('\n2️⃣ No exact matches, trying broader search...');
    const allDocuments = await getAllDocuments();
    const processedDocs = allDocuments.filter(doc => doc.processed);
    console.log(`Found ${processedDocs.length} processed documents`);
    
    if (processedDocs.length > 0) {
      // Get full content for all processed documents
      const fullDocs = await Promise.all(processedDocs.map(async (doc) => {
        const fullDoc = await getDocumentById(doc.id);
        return fullDoc;
      }));
      
      console.log(`Retrieved ${fullDocs.filter(doc => doc).length} full documents`);
      
      // Filter documents that contain any part of the query
      const queryWords = testPrompt.toLowerCase().split(/\s+/).filter(word => word.length > 2);
      console.log('Query words:', queryWords);
      
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
  
  // Step 3: Final fallback
  if (relevantDocuments.length === 0) {
    console.log('\n3️⃣ No relevant documents found, using final fallback...');
    const allDocuments = await getAllDocuments();
    const processedDocs = allDocuments.filter(doc => doc.processed);
    
    if (processedDocs.length > 0) {
      console.log("Including document summaries as final fallback");
      const docSummaries = await Promise.all(processedDocs.map(async (doc) => {
        const fullDoc = await getDocumentById(doc.id);
        if (fullDoc) {
          const summary = fullDoc.content.substring(0, 2000);
          return `=== DOCUMENT: ${fullDoc.originalName} ===\n${summary}...\n`;
        }
        return null;
      }));
      
      console.log(`Generated ${docSummaries.filter(doc => doc).length} document summaries`);
      if (docSummaries[0]) {
        console.log('First summary preview:', docSummaries[0]!.substring(0, 100) + '...');
      }
    }
  }
  
  // Step 4: Build context
  console.log('\n4️⃣ Building context...');
  let databaseContext = '';
  
  if (relevantDocuments.length > 0) {
    console.log(`Using ${relevantDocuments.length} relevant documents`);
    const relevantSections = relevantDocuments.map(doc => {
      return `=== DOCUMENT: ${doc.originalName} ===\n${doc.content}\n`;
    });
    databaseContext = `\n\nPRIMARY SOURCE - RELEVANT DOCUMENT SECTIONS:\n${relevantSections.join('\n')}`;
    console.log('Context length:', databaseContext.length);
    console.log('Context preview:', databaseContext.substring(0, 200) + '...');
  } else {
    console.log('No relevant documents found - this might be the issue!');
  }
  
  console.log('\n✅ AI flow test completed');
}

testAIFlow().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ AI flow test failed:', error);
  process.exit(1);
});
