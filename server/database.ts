// Initialize Supabase client with fallback for development
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder_key';

// Create a mock Supabase client for development if environment variables are missing
let supabase: any;

if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseKey === 'placeholder_key') {
  console.warn('⚠️  Using mock Supabase client for development. Set SUPABASE_URL and SUPABASE_ANON_KEY for production.');
  
  // Mock Supabase client for development
  supabase = {
    from: (table: string) => ({
      insert: async (data: any) => ({ data: { id: Date.now() }, error: null }),
      select: async () => ({ data: [], error: null }),
      update: async (data: any) => ({ data: [], error: null }),
      delete: async () => ({ data: [], error: null })
    })
  };
} else {
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(supabaseUrl, supabaseKey);
}

export { supabase };

// Enhanced document interface with metadata and tags
export interface Document {
  id: number;
  name: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  content: string;
  summary: string;
  tags: string[];
  metadata: {
    totalPages?: number;
    totalWords: number;
    language: string;
    hasImages: boolean;
    hasTables: boolean;
    processingTime: number;
    extractedAt: Date;
  };
  chunks: Array<{
    id: string;
    content: string;
    metadata: {
      page?: number;
      section?: string;
      wordCount: number;
      startIndex: number;
      endIndex: number;
    };
  }>;
  processed: boolean;
  uploadDate: Date;
  userId?: string;
  sessionId?: string;
}

// Session management interface
export interface ChatSession {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    documentsUsed?: string[];
  }>;
  documentIds: string[];
  createdAt: Date;
  lastUpdated: Date;
  userId?: string;
}

// Enhanced document content interface
export interface DocumentContent {
  id: number;
  documentId: number;
  content: string;
  summary: string;
  chunks: string; // JSON string of chunks
  metadata: string; // JSON string of metadata
  tags: string[]; // Array of tags
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Add a new document to the database
 */
export async function addDocument(document: Omit<Document, 'id'>): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .insert({
        name: document.name,
        original_name: document.originalName,
        file_type: document.fileType,
        file_size: document.fileSize,
        content: document.content,
        summary: document.summary,
        tags: document.tags,
        metadata: document.metadata,
        chunks: document.chunks,
        processed: document.processed,
        upload_date: document.uploadDate.toISOString(),
        user_id: document.userId,
        session_id: document.sessionId
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error adding document:', error);
      throw new Error(`Failed to add document: ${error.message}`);
    }

    console.log(`Document added with ID: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error('Database error adding document:', error);
    throw error;
  }
}

/**
 * Get all documents with full content and metadata
 */
export async function getAllDocuments(): Promise<Document[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('upload_date', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    return data.map(row => ({
      id: row.id,
      name: row.name,
      originalName: row.original_name,
      fileType: row.file_type,
      fileSize: row.file_size,
      content: row.content,
      summary: row.summary,
      tags: row.tags || [],
      metadata: row.metadata,
      chunks: row.chunks || [],
      processed: row.processed,
      uploadDate: new Date(row.upload_date),
      userId: row.user_id,
      sessionId: row.session_id
    }));
  } catch (error) {
    console.error('Database error fetching documents:', error);
    throw error;
  }
}

/**
 * Get documents for a specific session
 */
export async function getDocumentsForSession(sessionId: string): Promise<Document[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('session_id', sessionId)
      .order('upload_date', { ascending: false });

    if (error) {
      console.error('Error fetching session documents:', error);
      throw new Error(`Failed to fetch session documents: ${error.message}`);
    }

    return data.map(row => ({
      id: row.id,
      name: row.name,
      originalName: row.original_name,
      fileType: row.file_type,
      fileSize: row.file_size,
      content: row.content,
      summary: row.summary,
      tags: row.tags || [],
      metadata: row.metadata,
      chunks: row.chunks || [],
      processed: row.processed,
      uploadDate: new Date(row.upload_date),
      userId: row.user_id,
      sessionId: row.session_id
    }));
  } catch (error) {
    console.error('Database error fetching session documents:', error);
    throw error;
  }
}

/**
 * Get documents by tags
 */
export async function getDocumentsByTags(tags: string[]): Promise<Document[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .overlaps('tags', tags)
      .order('upload_date', { ascending: false });

    if (error) {
      console.error('Error fetching documents by tags:', error);
      throw new Error(`Failed to fetch documents by tags: ${error.message}`);
    }

    return data.map(row => ({
      id: row.id,
      name: row.name,
      originalName: row.original_name,
      fileType: row.file_type,
      fileSize: row.file_size,
      content: row.content,
      summary: row.summary,
      tags: row.tags || [],
      metadata: row.metadata,
      chunks: row.chunks || [],
      processed: row.processed,
      uploadDate: new Date(row.upload_date),
      userId: row.user_id,
      sessionId: row.session_id
    }));
  } catch (error) {
    console.error('Database error fetching documents by tags:', error);
    throw error;
  }
}

/**
 * Update document content and metadata
 */
export async function updateDocumentContent(
  documentId: number, 
  content: string, 
  summary: string, 
  chunks: any[], 
  metadata: any, 
  tags: string[]
): Promise<void> {
  try {
    const { error } = await supabase
      .from('documents')
      .update({
        content,
        summary,
        chunks,
        metadata,
        tags,
        processed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (error) {
      console.error('Error updating document content:', error);
      throw new Error(`Failed to update document content: ${error.message}`);
    }

    console.log(`Document ${documentId} content updated successfully`);
  } catch (error) {
    console.error('Database error updating document content:', error);
    throw error;
  }
}

/**
 * Get document content by ID
 */
export async function getDocumentContent(documentId: number): Promise<DocumentContent | null> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Document not found
      }
      console.error('Error fetching document content:', error);
      throw new Error(`Failed to fetch document content: ${error.message}`);
    }

    return {
      id: data.id,
      documentId: data.id,
      content: data.content,
      summary: data.summary,
      chunks: JSON.stringify(data.chunks || []),
      metadata: JSON.stringify(data.metadata || {}),
      tags: data.tags || [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  } catch (error) {
    console.error('Database error fetching document content:', error);
    throw error;
  }
}

/**
 * Delete document by ID
 */
export async function deleteDocument(documentId: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      console.error('Error deleting document:', error);
      throw new Error(`Failed to delete document: ${error.message}`);
    }

    console.log(`Document ${documentId} deleted successfully`);
  } catch (error) {
    console.error('Database error deleting document:', error);
    throw error;
  }
}

/**
 * Search documents by content (full-text search)
 */
export async function searchDocuments(query: string): Promise<Document[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .textSearch('content', query)
      .order('upload_date', { ascending: false });

    if (error) {
      console.error('Error searching documents:', error);
      throw new Error(`Failed to search documents: ${error.message}`);
    }

    return data.map(row => ({
      id: row.id,
      name: row.name,
      originalName: row.original_name,
      fileType: row.file_type,
      fileSize: row.file_size,
      content: row.content,
      summary: row.summary,
      tags: row.tags || [],
      metadata: row.metadata,
      chunks: row.chunks || [],
      processed: row.processed,
      uploadDate: new Date(row.upload_date),
      userId: row.user_id,
      sessionId: row.session_id
    }));
  } catch (error) {
    console.error('Database error searching documents:', error);
    throw error;
  }
}

/**
 * Save chat session
 */
export async function saveChatSession(session: ChatSession): Promise<void> {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .upsert({
        id: session.id,
        title: session.title,
        messages: session.messages,
        document_ids: session.documentIds,
        created_at: session.createdAt.toISOString(),
        last_updated: session.lastUpdated.toISOString(),
        user_id: session.userId
      });

    if (error) {
      console.error('Error saving chat session:', error);
      throw new Error(`Failed to save chat session: ${error.message}`);
    }

    console.log(`Chat session ${session.id} saved successfully`);
  } catch (error) {
    console.error('Database error saving chat session:', error);
    throw error;
  }
}

/**
 * Get chat sessions for a user
 */
export async function getChatSessions(userId?: string): Promise<ChatSession[]> {
  try {
    let query = supabase
      .from('chat_sessions')
      .select('*')
      .order('last_updated', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching chat sessions:', error);
      throw new Error(`Failed to fetch chat sessions: ${error.message}`);
    }

    return data.map(row => ({
      id: row.id,
      title: row.title,
      messages: row.messages || [],
      documentIds: row.document_ids || [],
      createdAt: new Date(row.created_at),
      lastUpdated: new Date(row.last_updated),
      userId: row.user_id
    }));
  } catch (error) {
    console.error('Database error fetching chat sessions:', error);
    throw error;
  }
}

/**
 * Delete chat session
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('Error deleting chat session:', error);
      throw new Error(`Failed to delete chat session: ${error.message}`);
    }

    console.log(`Chat session ${sessionId} deleted successfully`);
  } catch (error) {
    console.error('Database error deleting chat session:', error);
    throw error;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  totalDocuments: number;
  totalSessions: number;
  totalContent: number;
  averageDocumentSize: number;
}> {
  try {
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_size, content');

    const { data: sessions, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id');

    if (docError || sessionError) {
      throw new Error(`Failed to get database stats: ${docError?.message || sessionError?.message}`);
    }

    const totalContent = documents.reduce((sum, doc) => sum + (doc.content?.length || 0), 0);
    const averageDocumentSize = documents.length > 0 ? totalContent / documents.length : 0;

    return {
      totalDocuments: documents.length,
      totalSessions: sessions.length,
      totalContent,
      averageDocumentSize
    };
  } catch (error) {
    console.error('Database error getting stats:', error);
    throw error;
  }
}

// Legacy functions for backward compatibility
export async function getAllDocumentsForProcessing(): Promise<any[]> {
  return getAllDocuments();
}

export async function updateDocumentContent_legacy(documentId: number, content: string, summary: string): Promise<void> {
  return updateDocumentContent(documentId, content, summary, [], {}, []);
}
