import React, { useState, useRef, useEffect } from 'react';
import './RagChatbotWidget.css';

const API_URL = import.meta.env.VITE_RAG_CHATBOT_URL || 'http://localhost:8000';

export default function RagChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentFileName, setCurrentFileName] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  const handleToggle = () => setIsOpen(!isOpen);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) {
        throw new Error('Upload failed. Is the backend running?');
      }
      
      const data = await res.json();
      setSessionId(data.session_id);
      setCurrentFileName(file.name);
      setMessages([{ role: 'assistant', text: `Uploaded "${file.name}" successfully! What would you like to know about this document?` }]);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewDocument = async () => {
    // Delete current session on the backend
    if (sessionId) {
      try {
        await fetch(`${API_URL}/session/${sessionId}`, { method: 'DELETE' });
      } catch (err) {
        // Ignore errors — we're resetting anyway
      }
    }
    // Reset widget state back to upload view
    setSessionId(null);
    setMessages([]);
    setInputVal('');
    setCurrentFileName('');
    // Reset the file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputVal.trim() || !sessionId || isLoading) return;

    const query = inputVal.trim();
    setInputVal('');
    setMessages(prev => [...prev, { role: 'user', text: query }]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ session_id: sessionId, question: query })
      });
      
      if (!res.ok) {
        throw new Error('API Error');
      }
      
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, there was an error processing your request.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rag-chatbot-container">
      {isOpen && (
        <div className="rag-chatbot-window">
          <div className="rag-chatbot-header">
            <h4>AI Copilot</h4>
            <div className="rag-header-actions">
              {sessionId && (
                <button className="rag-new-doc-btn" onClick={handleNewDocument} title="Upload a different document">
                  📄 New Doc
                </button>
              )}
              <button className="rag-close-btn" onClick={handleToggle} title="Close">
                &times;
              </button>
            </div>
          </div>

          <div className="rag-chatbot-body">
            {!sessionId ? (
              <div className="rag-upload-view">
                <p>Upload a context document (PDF) to start asking questions.</p>
                <input 
                  type="file" 
                  accept=".pdf" 
                  onChange={handleFileUpload} 
                  disabled={isLoading}
                  ref={fileInputRef}
                />
                {isLoading && <span className="rag-loader">Uploading...</span>}
              </div>
            ) : (
              <>
                <div className="rag-messages">
                  {messages.map((m, i) => (
                    <div key={i} className={`rag-msg ${m.role}`}>
                      <div className="rag-msg-bubble">{m.text}</div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="rag-msg assistant">
                      <div className="rag-msg-bubble typing">Thinking...</div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                <form className="rag-input-form" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    placeholder="Ask a question..."
                    disabled={isLoading}
                    autoFocus
                  />
                  <button type="submit" disabled={isLoading || !inputVal.trim()} title="Send">
                    &#10148;
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <button className="rag-chatbot-toggle" onClick={handleToggle} title="AI Assistant">
        {isOpen ? '↓' : '🤖'}
      </button>
    </div>
  );
}
