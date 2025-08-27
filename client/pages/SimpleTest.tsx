import React from 'react';

export default function SimpleTest() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🚀 Simple Test Page</h1>
      <p>If you can see this, the server and routing are working!</p>
      <p>Current URL: {window.location.href}</p>
      <p>Port: {window.location.port}</p>
      
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
        <h3>Debug Info:</h3>
        <p>User Agent: {navigator.userAgent}</p>
        <p>Screen Size: {window.innerWidth} x {window.innerHeight}</p>
        <p>Is Mobile: {window.innerWidth < 768 ? 'Yes' : 'No'}</p>
      </div>
      
      <a 
        href="/" 
        style={{ 
          display: 'block', 
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: '#3b82f6', 
          color: 'white', 
          textDecoration: 'none',
          borderRadius: '5px',
          textAlign: 'center'
        }}
      >
        Go to Main App
      </a>
    </div>
  );
}
