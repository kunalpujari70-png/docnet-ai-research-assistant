import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { FileService, AuthService, FileMetadata } from '../services/supabase';
import Navigation from '../components/Navigation';
import './FileUpload.css';

interface UploadedFile extends FileMetadata {
  processed: boolean;
  content?: string;
  summary?: string;
}

export default function FileUpload() {
  const { theme } = useTheme();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    loadUploadedFiles();
  }, []);

  const loadUploadedFiles = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser) {
        console.log('Loading files for user:', currentUser.email);
        const files = await FileService.getUserFiles(currentUser.id);
        console.log('Loaded files from Supabase database:', files);
        setUploadedFiles(files as UploadedFile[]);
      } else {
        console.log('No authenticated user found');
        setUploadedFiles([]);
      }
    } catch (error) {
      console.error('Error loading uploaded files:', error);
      setUploadedFiles([]);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true);
    
    try {
      const currentUser = await AuthService.getCurrentUser();
      
      if (!currentUser) {
        alert('❌ Please log in to upload files');
        return;
      }

      console.log('Uploading files for user:', currentUser.email);
      
      const uploadPromises = Array.from(files).map(async (file) => {
        const result = await FileService.uploadFile(file, currentUser.id);
        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }
        return result;
      });

      await Promise.all(uploadPromises);
      await loadUploadedFiles(); // Reload from Supabase database
      
      alert(`✅ Successfully uploaded ${files.length} file(s) to Supabase!`);
    } catch (error) {
      console.error('Upload error:', error);
      alert('❌ Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files);
    }
  };

  const processDocuments = async () => {
    setIsProcessing(true);
    
    try {
      const currentUser = await AuthService.getCurrentUser();
      
      if (!currentUser) {
        alert('❌ Please log in to process files');
        return;
      }

      const unprocessedFiles = uploadedFiles.filter(file => !file.processed);
      console.log('Processing files:', unprocessedFiles.map(f => f.name));
      
      if (unprocessedFiles.length === 0) {
        alert('✅ All files are already processed!');
        return;
      }
      
      console.log('Processing files with AI analysis for user:', currentUser.email);
      
      // Process all files and track results
      const processingResults = [];
      for (const file of unprocessedFiles) {
        try {
          console.log(`Processing file: ${file.name}...`);
          
          const result = await FileService.processFile(file.id);
          if (result.success) {
            console.log('Successfully processed file with AI analysis:', file.name);
            processingResults.push({ 
              file: file.name, 
              success: true,
              message: 'AI analysis completed successfully'
            });
          } else {
            console.error('Processing failed for file:', file.name, result.error);
            processingResults.push({ 
              file: file.name, 
              success: false, 
              error: result.error 
            });
          }
        } catch (error) {
          console.error('Processing error for file:', file.name, error);
          processingResults.push({ 
            file: file.name, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }
      
      // Reload files to get updated processing status
      await loadUploadedFiles();
      
      // Show detailed results
      const successful = processingResults.filter(r => r.success).length;
      const failed = processingResults.filter(r => !r.success).length;
      
      let resultMessage = `AI Processing Complete!\n\n`;
      resultMessage += `✅ Successfully processed: ${successful} file(s)\n`;
      if (failed > 0) {
        resultMessage += `❌ Failed to process: ${failed} file(s)\n\n`;
        resultMessage += `Failed files:\n`;
        processingResults
          .filter(r => !r.success)
          .forEach(r => {
            resultMessage += `• ${r.file}: ${r.error}\n`;
          });
      }
      
      if (successful > 0) {
        resultMessage += `\n🎉 Your documents are now ready for AI-powered analysis! You can:\n`;
        resultMessage += `• Ask questions about your documents\n`;
        resultMessage += `• Request summaries and key insights\n`;
        resultMessage += `• Get comparative analysis across documents\n`;
        resultMessage += `• Explore trends and patterns in your data`;
      }
      
      alert(resultMessage);
      
    } catch (error) {
      console.error('Processing error:', error);
      alert('❌ Processing failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      
      if (!currentUser) {
        alert('❌ Please log in to delete files');
        return;
      }

      const success = await FileService.deleteFile(fileId, currentUser.id);
      if (success) {
        await loadUploadedFiles(); // Reload from database
        alert('✅ File deleted successfully!');
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('❌ Delete failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="file-upload-page">
      <Navigation currentPage="upload" />
      
      <div className="file-upload-container">
        {/* Header Section */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="18" cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
                <path d="M18 16V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="header-text">
              <h1 className="page-title">Document Upload</h1>
              <p className="page-subtitle">Upload documents to unlock the full power of DocNet research</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="file-upload-content">
          {/* Upload Section */}
          <div className="upload-section">
            <div className="section-header">
              <h2 className="section-title">Upload Documents</h2>
              <p className="section-subtitle">
                Drag and drop files here or click to browse. Supported formats: PDF, DOC, DOCX, TXT
              </p>
            </div>
            
            <div 
              className={`upload-area ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="upload-content">
                <div className="upload-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 className="upload-title">Drop files here</h3>
                <p className="upload-hint">or click to select files</p>
                <input
                  type="file"
                  multiple
                  onChange={handleFileInput}
                  className="file-input"
                  accept=".pdf,.doc,.docx,.txt"
                />
                <button className="upload-btn" onClick={() => (document.querySelector('.file-input') as HTMLInputElement)?.click()}>
                  Select Files
                </button>
              </div>
            </div>
          </div>

          {/* Files Section */}
          <div className="files-section">
            <div className="files-header">
              <h3 className="files-title">Uploaded Files</h3>
              {uploadedFiles.length > 0 && (
                <button 
                  className="process-btn"
                  onClick={processDocuments}
                  disabled={isProcessing || uploadedFiles.every(f => f.processed)}
                >
                  {isProcessing ? 'Processing...' : 'Process All'}
                </button>
              )}
            </div>
            
            <div className="files-list">
              {uploadedFiles.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h4 className="empty-title">No files uploaded yet</h4>
                  <p className="empty-description">
                    Upload your first document to get started with AI-powered analysis
                  </p>
                </div>
              ) : (
                uploadedFiles.map((file) => (
                  <div key={file.id} className="file-item">
                    <div className="file-header">
                      <div className="file-info">
                        <h4 className="file-name">{file.name}</h4>
                        <p className="file-meta">
                          {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="file-actions">
                        <div className="file-status">
                          <span className={`status-indicator ${file.processed ? 'processed' : 'pending'}`}>
                            {file.processed ? 'Processed' : 'Pending'}
                          </span>
                        </div>
                        <button 
                          className="action-btn delete-btn"
                          onClick={() => deleteFile(file.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    {file.processed && file.content && (
                      <div className="file-content">
                        <div className="content-preview">
                          <strong>Content Preview:</strong> {file.content.substring(0, 200)}...
                        </div>
                        {file.summary && (
                          <div className="summary-section">
                            <strong>Summary:</strong> {file.summary}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {(isUploading || isProcessing) && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <span>{isUploading ? 'Uploading...' : 'Processing...'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
