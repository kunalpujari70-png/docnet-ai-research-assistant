import { getAllDocuments, updateDocumentContent } from './database';
import path from 'path';
import fs from 'fs';

function cleanDatabase() {
  try {
    console.log('Starting database cleanup...');
    
    // Read the database file directly since we need to modify it
    const dbPath = path.join(process.cwd(), 'knowledge_base.json');
    
    if (!fs.existsSync(dbPath)) {
      console.log('Database file does not exist');
      return;
    }
    
    console.log('Reading database file...');
    const data = fs.readFileSync(dbPath, 'utf-8');
    const db = JSON.parse(data);
    
    console.log(`Found ${db.documents.length} documents in database`);
    
    // Remove duplicates based on originalName
    const seen = new Set();
    const uniqueDocuments = db.documents.filter((doc: any) => {
      if (seen.has(doc.originalName)) {
        console.log(`Removing duplicate: ${doc.originalName}`);
        return false;
      }
      seen.add(doc.originalName);
      return true;
    });
    
    console.log(`Removed ${db.documents.length - uniqueDocuments.length} duplicate documents`);
    console.log(`Remaining documents: ${uniqueDocuments.length}`);
    db.documents = uniqueDocuments;
    
    // Update nextId to be the max ID + 1
    if (uniqueDocuments.length > 0) {
      const maxId = Math.max(...uniqueDocuments.map((doc: any) => doc.id));
      db.nextId = maxId + 1;
      console.log(`Updated nextId to: ${db.nextId}`);
    }
    
    // Write back to file
    console.log('Writing cleaned database back to file...');
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log('Database cleaned successfully');
    
  } catch (error) {
    console.error('Error cleaning database:', error);
  }
}

cleanDatabase();
