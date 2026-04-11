import React from 'react';
import { useToast } from '../context/ToastContext';
import '../styles/Toast.css';

const Toast = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-message">{toast.message}</span>
          <button
            className="toast-close"
            onClick={() => removeToast(toast.id)}
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
