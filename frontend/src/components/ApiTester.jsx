import React, { useState } from 'react';
import { Database, Plus, Trash2, Send, Zap } from 'lucide-react';

export default function ApiTester({ items, onAddItem, onDeleteItem, latency }) {
  const [newTitle, setNewTitle] = useState('');
  const [category, setCategory] = useState('Frontend');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    await onAddItem(newTitle.trim(), category);
    setNewTitle('');
    setIsSubmitting(false);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-group">
          <div className="card-icon" style={{ color: '#818cf8' }}>
            <Database size={20} />
          </div>
          <div>
            <h3>API Integration Test</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Live CRUD requests to backend service
            </span>
          </div>
        </div>

        {latency !== null && (
          <div className="badge badge-docker" style={{ fontSize: '0.75rem' }}>
            <Zap size={12} />
            <span>{latency} ms roundtrip</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="form-group">
        <input 
          type="text" 
          className="input-field"
          placeholder="Add a new task or microservice..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <select 
          className="input-field" 
          style={{ maxWidth: '140px' }}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="Frontend">Frontend</option>
          <option value="Backend">Backend</option>
          <option value="Database">Database</option>
          <option value="DevOps">DevOps</option>
          <option value="AI / ML">AI / ML</option>
        </select>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting || !newTitle.trim()}>
          <Plus size={16} />
          <span>Add</span>
        </button>
      </form>

      <div className="item-list">
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            No items found. Create your first item above!
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="item-row">
              <div className="item-info">
                <span className="item-badge">{item.category || 'General'}</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>{item.title}</span>
              </div>
              <button 
                className="btn btn-danger btn-sm"
                onClick={() => onDeleteItem(item.id)}
                title="Delete item"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
