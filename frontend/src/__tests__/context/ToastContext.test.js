import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../../context/ToastContext';

describe('ToastContext', () => {
  it('should provide toast context', () => {
    const { container } = render(
      <ToastProvider>
        <div>Test</div>
      </ToastProvider>
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('should render children', () => {
    const { container } = render(
      <ToastProvider>
        <div data-testid="child">Child</div>
      </ToastProvider>
    );
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy();
  });

  it('should export useToast hook', () => {
    expect(useToast).toBeDefined();
    expect(typeof useToast).toBe('function');
  });

  it('should throw error when useToast is used outside of ToastProvider', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    const TestComponent = () => {
      useToast();
      return <div>Should not render</div>;
    };

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useToast must be used within ToastProvider');

    consoleErrorSpy.mockRestore();
  });

  it('should add a toast with message and default type', async () => {
    const TestComponent = () => {
      const { toasts, addToast } = useToast();

      React.useEffect(() => {
        addToast('Test message', 'info', 0);
      }, [addToast]);

      return <div data-testid="toast-count">{toasts.length}</div>;
    };

    const { getByTestId } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(getByTestId('toast-count').textContent).toBe('1');
    });
  });

  it('should add a toast and remove it after duration', async () => {
    jest.useFakeTimers();

    const TestComponent = () => {
      const { toasts, addToast } = useToast();

      React.useEffect(() => {
        addToast('Test message', 'info', 1000);
      }, [addToast]);

      return <div data-testid="toast-count">{toasts.length}</div>;
    };

    const { getByTestId } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    // Initially should have 1 toast
    expect(getByTestId('toast-count').textContent).toBe('1');

    // After 1 second, toast should be removed
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(getByTestId('toast-count').textContent).toBe('0');
    });

    jest.useRealTimers();
  });

  it('should add a toast with zero duration and not remove it', async () => {
    jest.useFakeTimers();

    const TestComponent = () => {
      const { toasts, addToast } = useToast();

      React.useEffect(() => {
        addToast('Persistent message', 'warning', 0);
      }, [addToast]);

      return <div data-testid="toast-count">{toasts.length}</div>;
    };

    const { getByTestId } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    // Initially should have 1 toast
    expect(getByTestId('toast-count').textContent).toBe('1');

    // Advance time - toast should still be there
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(getByTestId('toast-count').textContent).toBe('1');

    jest.useRealTimers();
  });

  it('should manually remove a toast', async () => {
    const TestComponent = () => {
      const { toasts, addToast, removeToast } = useToast();
      const [toastId, setToastId] = React.useState(null);

      React.useEffect(() => {
        const id = addToast('Test message', 'info', 0);
        setToastId(id);
      }, [addToast]);

      return (
        <div>
          <div data-testid="toast-count">{toasts.length}</div>
          <button
            data-testid="remove-btn"
            onClick={() => toastId && removeToast(toastId)}
          >
            Remove
          </button>
        </div>
      );
    };

    const { getByTestId } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(getByTestId('toast-count').textContent).toBe('1');
    });

    await act(async () => {
      fireEvent.click(getByTestId('remove-btn'));
    });

    await waitFor(() => {
      expect(getByTestId('toast-count').textContent).toBe('0');
    });
  });

  it('should support different toast types', async () => {
    const TestComponent = () => {
      const { toasts, addToast } = useToast();

      React.useEffect(() => {
        addToast('Info toast', 'info', 0);
        addToast('Success toast', 'success', 0);
        addToast('Error toast', 'error', 0);
      }, [addToast]);

      return (
        <div>
          {toasts.map((toast, idx) => (
            <div key={idx} data-testid={`toast-${toast.type}`}>
              {toast.message} - {toast.type}
            </div>
          ))}
        </div>
      );
    };

    const { getByTestId } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(getByTestId('toast-info')).toBeInTheDocument();
      expect(getByTestId('toast-success')).toBeInTheDocument();
      expect(getByTestId('toast-error')).toBeInTheDocument();
    });
  });
});
