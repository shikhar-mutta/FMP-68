import React from 'react';
import { useToast } from '../context/ToastContext';
import '../styles/Toast.css';

const Toast = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}${toast.onClick ? ' toast-clickable' : ''}`}
          onClick={toast.onClick ? () => { toast.onClick(); removeToast(toast.id); } : undefined}
        >
          <span className="toast-message">{toast.message}</span>
          {toast.onClick && <span className="toast-arrow">→</span>}
          <button
            className="toast-close"
            onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}
            aria-label="Close toast"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast;
