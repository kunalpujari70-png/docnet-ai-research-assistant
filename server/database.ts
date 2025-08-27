import path from 'path';
import fs from 'fs';

// Database file path
const dbPath = path.join(process.cwd(), 'knowledge_base.json');

interface Document {
  id: number;
  filename: string;
  originalName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  processed: boolean;
  content?: string;
  summary?: string;
  tags?: string[];
  category?: string;
}



interface Template {
  id: number;
  name: string;
  description: string;
  outputType: string;
  promptTemplate: string;
  exampleInput: string;
  exampleOutput: string;
  category: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
}

interface Database {
  documents: Document[];
  templates: Template[];
  nextId: number;
  nextTemplateId: number;
}

// Initialize database
export function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(dbPath)) {
        const initialDb: Database = {
          documents: [],
          templates: [],
          nextId: 1,
          nextTemplateId: 1
        };
        fs.writeFileSync(dbPath, JSON.stringify(initialDb, null, 2));
        console.log('Database initialized successfully with default prompts and templates');
      } else {
        console.log('Database already exists');
      }
      resolve();
    } catch (error) {
      console.error('Error initializing database:', error);
      reject(error);
    }
  });
}

// Read database
function readDatabase(): Database {
  try {
    if (!fs.existsSync(dbPath)) {
          return { 
      documents: [], 
      templates: [],
      nextId: 1,
      nextTemplateId: 1
    };
    }
    const data = fs.readFileSync(dbPath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Handle legacy database format
    if (!parsed.templates) {
      parsed.templates = [];
    }
    if (!parsed.nextTemplateId) {
      parsed.nextTemplateId = 1;
    }
    
    return parsed;
  } catch (error) {
    console.error('Error reading database:', error);
    return { 
      documents: [], 
      templates: [],
      nextId: 1,
      nextTemplateId: 1
    };
  }
}

// Write database
function writeDatabase(db: Database): void {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error writing database:', error);
  }
}

// Add a document to the database
export function addDocument(documentInfo: {
  filename: string;
  originalName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  content?: string;
  summary?: string;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const db = readDatabase();
      
      const document: Document = {
        id: db.nextId++,
        filename: documentInfo.filename,
        originalName: documentInfo.originalName,
        filePath: documentInfo.filePath,
        fileType: documentInfo.fileType,
        fileSize: documentInfo.fileSize,
        uploadDate: new Date().toISOString(),
        processed: !!documentInfo.content,
        content: documentInfo.content,
        summary: documentInfo.summary
      };
      
      db.documents.push(document);
      writeDatabase(db);
      
      console.log(`Document added to database with ID: ${document.id}`);
      resolve(document.id);
    } catch (error) {
      console.error('Error adding document:', error);
      reject(error);
    }
  });
}

// Search documents by content
export function searchDocuments(query: string): Promise<Array<{
  id: number;
  originalName: string;
  content: string;
  summary: string;
  uploadDate: string;
}>> {
  return new Promise((resolve, reject) => {
    try {
      const db = readDatabase();
      const queryLower = query.toLowerCase();
      
      // Extract key terms from the query (remove common words)
      const commonWords = ['what', 'is', 'are', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
      const queryTerms = queryLower
        .split(/\s+/)
        .filter(term => term.length > 2 && !commonWords.includes(term));
      
      console.log('Search terms:', queryTerms);
      
      const results = db.documents
        .filter(doc => doc.processed && doc.content)
        .filter(doc => {
          const contentLower = doc.content!.toLowerCase();
          const summaryLower = doc.summary?.toLowerCase() || '';
          const nameLower = doc.originalName.toLowerCase();
          
          // Check if any of the query terms are found in the document
          return queryTerms.some(term => 
            contentLower.includes(term) ||
            summaryLower.includes(term) ||
            nameLower.includes(term)
          ) || contentLower.includes(queryLower); // Also check the full query
        })
        .map(doc => ({
          id: doc.id,
          originalName: doc.originalName,
          content: doc.content!,
          summary: doc.summary || '',
          uploadDate: doc.uploadDate
        }))
        .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
        .slice(0, 10);
      
      console.log(`Found ${results.length} documents matching terms:`, queryTerms);
      resolve(results);
    } catch (error) {
      console.error('Error searching documents:', error);
      reject(error);
    }
  });
}

// Get all documents with full details (for processing)
export function getAllDocumentsForProcessing(): Promise<Array<{
  id: number;
  filename: string;
  originalName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  processed: boolean;
}>> {
  return new Promise((resolve, reject) => {
    try {
      const db = readDatabase();
      const documents = db.documents
        .map(doc => ({
          id: doc.id,
          filename: doc.filename,
          originalName: doc.originalName,
          filePath: doc.filePath,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          uploadDate: doc.uploadDate,
          processed: doc.processed
        }))
        .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
      
      resolve(documents);
    } catch (error) {
      console.error('Error getting documents for processing:', error);
      reject(error);
    }
  });
}

// Get document by ID with full content
export function getDocumentById(id: number): Promise<{
  id: number;
  originalName: string;
  content: string;
  summary: string;
  uploadDate: string;
} | null> {
  return new Promise((resolve, reject) => {
    try {
      const db = readDatabase();
      const document = db.documents.find(doc => doc.id === id);
      
      if (document && document.processed && document.content) {
        resolve({
          id: document.id,
          originalName: document.originalName,
          content: document.content,
          summary: document.summary || '',
          uploadDate: document.uploadDate
        });
      } else {
        resolve(null);
      }
    } catch (error) {
      console.error('Error getting document by ID:', error);
      reject(error);
    }
  });
}

// Get all documents (summary view)
export function getAllDocuments(): Promise<Array<{
  id: number;
  originalName: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  processed: boolean;
}>> {
  return new Promise((resolve, reject) => {
    try {
      const db = readDatabase();
      const documents = db.documents
        .map(doc => ({
          id: doc.id,
          originalName: doc.originalName,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          uploadDate: doc.uploadDate,
          processed: doc.processed
        }))
        .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
      
      resolve(documents);
    } catch (error) {
      console.error('Error getting documents:', error);
      reject(error);
    }
  });
}

// Get document content by ID
export function getDocumentContent(documentId: number): Promise<{
  content: string;
  summary: string;
  originalName: string;
} | null> {
  return new Promise((resolve, reject) => {
    try {
      const db = readDatabase();
      const document = db.documents.find(doc => doc.id === documentId && doc.processed);
      
      if (document && document.content) {
        resolve({
          content: document.content,
          summary: document.summary || '',
          originalName: document.originalName
        });
      } else {
        resolve(null);
      }
    } catch (error) {
      console.error('Error getting document content:', error);
      reject(error);
    }
  });
}

// Update document content (for when we process PDFs)
export function updateDocumentContent(documentId: number, content: string, summary?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const db = readDatabase();
      const document = db.documents.find(doc => doc.id === documentId);
      
      if (document) {
        document.content = content;
        document.summary = summary;
        document.processed = true;
        writeDatabase(db);
        console.log(`Document ${documentId} updated successfully`);
      }
      
      resolve();
    } catch (error) {
      console.error('Error updating document content:', error);
      reject(error);
    }
  });
}



// Template Functions
export function getAllTemplates(): Promise<Template[]> {
  return new Promise((resolve, reject) => {
    try {
      const db = readDatabase();
      resolve(db.templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error('Error getting templates:', error);
      reject(error);
    }
  });
}

export function getTemplateById(id: number): Promise<Template | null> {
  return new Promise((resolve, reject) => {
    try {
      const db = readDatabase();
      const template = db.templates.find(t => t.id === id);
      resolve(template || null);
    } catch (error) {
      console.error('Error getting template:', error);
      reject(error);
    }
  });
}

export function createTemplate(template: Omit<Template, 'id' | 'createdAt'>): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const db = readDatabase();
      const newTemplate: Template = {
        ...template,
        id: db.nextTemplateId++,
        createdAt: new Date().toISOString()
      };
      
      db.templates.push(newTemplate);
      writeDatabase(db);
      resolve(newTemplate.id);
    } catch (error) {
      console.error('Error creating template:', error);
      reject(error);
    }
  });
}

// Enhanced Document Functions
export function addDocumentTags(documentId: number, tags: string[], category?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const db = readDatabase();
      const document = db.documents.find(doc => doc.id === documentId);
      
      if (document) {
        document.tags = tags;
        if (category) document.category = category;
        writeDatabase(db);
      }
      
      resolve();
    } catch (error) {
      console.error('Error adding document tags:', error);
      reject(error);
    }
  });
}

export function searchDocumentsByTags(tags: string[]): Promise<Array<{
  id: number;
  originalName: string;
  content: string;
  summary: string;
  uploadDate: string;
  tags?: string[];
  category?: string;
}>> {
  return new Promise((resolve, reject) => {
    try {
      const db = readDatabase();
      const tagSet = new Set(tags.map(t => t.toLowerCase()));
      
      const results = db.documents
        .filter(doc => doc.processed && doc.content && doc.tags)
        .filter(doc => doc.tags!.some(tag => tagSet.has(tag.toLowerCase())))
        .map(doc => ({
          id: doc.id,
          originalName: doc.originalName,
          content: doc.content!,
          summary: doc.summary || '',
          uploadDate: doc.uploadDate,
          tags: doc.tags,
          category: doc.category
        }))
        .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
      
      resolve(results);
    } catch (error) {
      console.error('Error searching documents by tags:', error);
      reject(error);
    }
  });
}

export function getDocumentsByCategory(category: string): Promise<Array<{
  id: number;
  originalName: string;
  content: string;
  summary: string;
  uploadDate: string;
  tags?: string[];
  category?: string;
}>> {
  return new Promise((resolve, reject) => {
    try {
      const db = readDatabase();
      const results = db.documents
        .filter(doc => doc.processed && doc.content && doc.category === category)
        .map(doc => ({
          id: doc.id,
          originalName: doc.originalName,
          content: doc.content!,
          summary: doc.summary || '',
          uploadDate: doc.uploadDate,
          tags: doc.tags,
          category: doc.category
        }))
        .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
      
      resolve(results);
    } catch (error) {
      console.error('Error getting documents by category:', error);
      reject(error);
    }
  });
}
