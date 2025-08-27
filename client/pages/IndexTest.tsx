import React from 'react';

export default function IndexTest() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f0f8ff 0%, #ffffff 50%, #f8f0ff 100%)',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          color: 'white',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: 'bold' }}>
            🌟 Trauma Healing AI Portal
          </h1>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Personalized healing guidance powered by AI
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '2rem' }}>
          <div style={{ 
            background: '#f0f8ff', 
            padding: '1.5rem', 
            borderRadius: '8px', 
            marginBottom: '2rem',
            border: '1px solid #e0e7ff'
          }}>
            <h2 style={{ margin: '0 0 1rem 0', color: '#1f2937', fontSize: '1.25rem' }}>
              ✅ Application Status
            </h2>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <div style={{ color: '#10b981' }}>✅ React is working</div>
              <div style={{ color: '#10b981' }}>✅ Routing is functional</div>
              <div style={{ color: '#10b981' }}>✅ Styles are loading</div>
              <div style={{ color: '#3b82f6' }}>🔄 Ready for full chat interface</div>
            </div>
          </div>

          <div style={{ 
            background: '#fff7ed', 
            padding: '1.5rem', 
            borderRadius: '8px',
            border: '1px solid #fed7aa'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#ea580c' }}>
              🚧 Development Mode
            </h3>
            <p style={{ margin: 0, color: '#9a3412' }}>
              This is a simplified test version of the Index component. 
              The full chat interface will be restored once we confirm this is working.
            </p>
          </div>

          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <button 
              style={{
                padding: '1rem 2rem',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.4)'
              }}
              onClick={() => alert('Test button clicked! React is working perfectly.')}
            >
              🧪 Test React Functionality
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
