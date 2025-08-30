import { searchDocuments, getAllDocuments } from './database';

async function testSearch() {
  console.log('🧪 Testing document search functionality...\n');
  
  // Test 1: Get all documents
  console.log('📋 Getting all documents:');
  const allDocs = await getAllDocuments();
  console.log(`Found ${allDocs.length} documents in database`);
  allDocs.forEach(doc => {
    console.log(`- ${doc.originalName} (ID: ${doc.id}, Processed: ${doc.processed})`);
  });
  console.log('');
  
  // Test 2: Search for AI-related content
  console.log('🔍 Searching for "artificial intelligence":');
  const aiResults = await searchDocuments('artificial intelligence');
  console.log(`Found ${aiResults.length} results for "artificial intelligence"`);
  aiResults.forEach((doc, index) => {
    console.log(`${index + 1}. ${doc.originalName}`);
    console.log(`   Content preview: ${doc.content.substring(0, 100)}...`);
  });
  console.log('');
  
  // Test 3: Search for blockchain content
  console.log('🔍 Searching for "blockchain":');
  const blockchainResults = await searchDocuments('blockchain');
  console.log(`Found ${blockchainResults.length} results for "blockchain"`);
  blockchainResults.forEach((doc, index) => {
    console.log(`${index + 1}. ${doc.originalName}`);
    console.log(`   Content preview: ${doc.content.substring(0, 100)}...`);
  });
  console.log('');
  
  // Test 4: Search for neural networks
  console.log('🔍 Searching for "neural networks":');
  const neuralResults = await searchDocuments('neural networks');
  console.log(`Found ${neuralResults.length} results for "neural networks"`);
  neuralResults.forEach((doc, index) => {
    console.log(`${index + 1}. ${doc.originalName}`);
    console.log(`   Content preview: ${doc.content.substring(0, 100)}...`);
  });
  console.log('');
  
  // Test 5: Search for cryptocurrency
  console.log('🔍 Searching for "cryptocurrency":');
  const cryptoResults = await searchDocuments('cryptocurrency');
  console.log(`Found ${cryptoResults.length} results for "cryptocurrency"`);
  cryptoResults.forEach((doc, index) => {
    console.log(`${index + 1}. ${doc.originalName}`);
    console.log(`   Content preview: ${doc.content.substring(0, 100)}...`);
  });
}

testSearch().then(() => {
  console.log('✅ Search test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Search test failed:', error);
  process.exit(1);
});
