import React from 'react';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-4">🚀 Server Test</h1>
        <div className="space-y-4">
          <div className="p-4 bg-green-100 rounded-lg">
            <p className="text-green-800 font-medium">✅ Server is running!</p>
            <p className="text-green-600 text-sm">If you can see this, the server is working properly.</p>
          </div>
          
          <div className="p-4 bg-blue-100 rounded-lg">
            <p className="text-blue-800 font-medium">📱 Mobile Detection Test</p>
            <p className="text-blue-600 text-sm">
              Screen width: {window.innerWidth}px<br/>
              Is mobile: {window.innerWidth < 768 ? 'Yes' : 'No'}
            </p>
          </div>
          
          <div className="p-4 bg-purple-100 rounded-lg">
            <p className="text-purple-800 font-medium">🔧 PWA Status</p>
            <p className="text-purple-600 text-sm">
              Service Worker: {('serviceWorker' in navigator) ? 'Supported' : 'Not Supported'}<br/>
              HTTPS: {window.location.protocol === 'https:' ? 'Yes' : 'No (Development)'}
            </p>
          </div>
          
          <a 
            href="/" 
            className="block w-full text-center bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Go to Main App
          </a>
        </div>
      </div>
    </div>
  );
}
