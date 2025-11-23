'use client';

import { useState } from 'react';

import QueryPanel from '@/components/QueryPanel';
import ValidationPanel from '@/components/ValidationPanel';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'query' | 'validate'>('query');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <header
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #e0e0e0',
          padding: '1rem 2rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
          Persistent Memory RAG - Demo
        </h1>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
          Week 2: Embedding & Retrieval Layer
        </p>
      </header>

      <div style={{ padding: '2rem' }}>
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #e0e0e0',
            }}
          >
            <button
              onClick={() => setActiveTab('query')}
              style={{
                flex: 1,
                padding: '1rem',
                border: 'none',
                backgroundColor: activeTab === 'query' ? 'white' : '#f5f5f5',
                borderBottom: activeTab === 'query' ? '2px solid #2563eb' : 'none',
                fontWeight: activeTab === 'query' ? 600 : 400,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Query Interface
            </button>
            <button
              onClick={() => setActiveTab('validate')}
              style={{
                flex: 1,
                padding: '1rem',
                border: 'none',
                backgroundColor: activeTab === 'validate' ? 'white' : '#f5f5f5',
                borderBottom: activeTab === 'validate' ? '2px solid #2563eb' : 'none',
                fontWeight: activeTab === 'validate' ? 600 : 400,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Validation Metrics
            </button>
          </div>

          <div style={{ padding: '2rem' }}>
            {activeTab === 'query' ? <QueryPanel /> : <ValidationPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
