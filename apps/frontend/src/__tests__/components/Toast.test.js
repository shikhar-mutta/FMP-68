import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Toast from '../../components/Toast';
import { ToastProvider, useToast } from '../../context/ToastContext';

jest.mock('../../styles/Toast.css', () => ({}));

// Helper component to add toasts for testing
const ToastTester = ({ children }) => {
  return <ToastProvider>{children}</ToastProvider>;
};

const AddToastButton = ({ message , type = 'success' }) => {
  const { addToast } = useToast();
  return (
    <button onClick={() => addToast(message, type)}>
      Add Toast
    </button>
  );
};

describe('Toast Component', () => {
  it('should render toast container', () => {
    render(
      <ToastTester>
        <Toast />
      </ToastTester>
    );

    const container = document.querySelector('.toast-container');
    expect(container).toBeInTheDocument();
  });

  it('should render empty when no toasts', () => {
    render(
      <ToastTester>
        <Toast />
      </ToastTester>
    );

    const container = document.querySelector('.toast-container');
    expect(container.children.length).toBe(0);
  });

  it('should render single toast with message', () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      
      React.useEffect(() => {
        addToast('Success message', 'success');
      }, [addToast]);
      
      return <Toast />;
    };

    render(
      <ToastTester>
        <TestComponent />
      </ToastTester>
    );

    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('should render multiple toasts', () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      
      React.useEffect(() => {
        addToast('First toast', 'success');
        addToast('Second toast', 'error');
      }, [addToast]);
      
      return <Toast />;
    };

    render(
      <ToastTester>
        <TestComponent />
      </ToastTester>
    );

    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
  });

  it('should apply correct CSS class for toast type', () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      
      React.useEffect(() => {
        addToast('Success', 'success');
      }, [addToast]);
      
      return <Toast />;
    };

    const { container } = render(
      <ToastTester>
        <TestComponent />
      </ToastTester>
    );

    const toast = container.querySelector('.toast-success');
    expect(toast).toBeInTheDocument();
  });

  it('should render close button', () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      
      React.useEffect(() => {
        addToast('Test message', 'success');
      }, [addToast]);
      
      return <Toast />;
    };

    render(
      <ToastTester>
        <TestComponent />
      </ToastTester>
    );

    const closeButtons = screen.getAllByLabelText('Close toast');
    expect(closeButtons.length).toBeGreaterThan(0);
  });

  it('should remove toast when close button is clicked', async () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      
      React.useEffect(() => {
        addToast('Removable toast', 'success');
      }, [addToast]);
      
      return <Toast />;
    };

    render(
      <ToastTester>
        <TestComponent />
      </ToastTester>
    );

    expect(screen.getByText('Removable toast')).toBeInTheDocument();

    const closeButton = screen.getByLabelText('Close toast');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Removable toast')).not.toBeInTheDocument();
    });
  });

  it('should render error toast with correct class', () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      
      React.useEffect(() => {
        addToast('Error occurred', 'error');
      }, [addToast]);
      
      return <Toast />;
    };

    const { container } = render(
      <ToastTester>
        <TestComponent />
      </ToastTester>
    );

    const toast = container.querySelector('.toast-error');
    expect(toast).toBeInTheDocument();
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });

  it('should render warning toast with correct class', () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      
      React.useEffect(() => {
        addToast('Warning message', 'warning');
      }, [addToast]);
      
      return <Toast />;
    };

    const { container } = render(
      <ToastTester>
        <TestComponent />
      </ToastTester>
    );

    const toast = container.querySelector('.toast-warning');
    expect(toast).toBeInTheDocument();
    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('should render info toast with correct class', () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      
      React.useEffect(() => {
        addToast('Info message', 'info');
      }, [addToast]);
      
      return <Toast />;
    };

    const { container } = render(
      <ToastTester>
        <TestComponent />
      </ToastTester>
    );

    const toast = container.querySelector('.toast-info');
    expect(toast).toBeInTheDocument();
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('should have proper DOM structure', () => {
    const { container } = render(
      <ToastTester>
        <Toast />
      </ToastTester>
    );

    expect(container.querySelector('.toast-container')).toBeTruthy();
  });

  it('should render each toast with unique key', () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      
      React.useEffect(() => {
        addToast('Toast 1', 'success');
        addToast('Toast 2', 'success');
        addToast('Toast 3', 'success');
      }, [addToast]);
      
      return <Toast />;
    };

    render(
      <ToastTester>
        <TestComponent />
      </ToastTester>
    );

    expect(screen.getByText('Toast 1')).toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
    expect(screen.getByText('Toast 3')).toBeInTheDocument();
  });

  it('should remove only clicked toast from multiple toasts', async () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      
      React.useEffect(() => {
        addToast('Toast A', 'success', 0);
        addToast('Toast B', 'success', 0);
        addToast('Toast C', 'success', 0);
      }, [addToast]);
      
      return <Toast />;
    };

    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockImplementationOnce(() => 1000)
      .mockImplementationOnce(() => 2000)
      .mockImplementationOnce(() => 3000);

    render(
      <ToastTester>
        <TestComponent />
      </ToastTester>
    );

    expect(screen.getByText('Toast A')).toBeInTheDocument();
    expect(screen.getByText('Toast B')).toBeInTheDocument();
    expect(screen.getByText('Toast C')).toBeInTheDocument();

    const closeButtons = screen.getAllByLabelText('Close toast');
    fireEvent.click(closeButtons[1]); // Close Toast B

    await waitFor(() => {
      expect(screen.getByText('Toast A')).toBeInTheDocument();
      expect(screen.queryByText('Toast B')).not.toBeInTheDocument();
      expect(screen.getByText('Toast C')).toBeInTheDocument();
    });

    nowSpy.mockRestore();
  });

  it('should have close button with aria label', () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      
      React.useEffect(() => {
        addToast('Test', 'success');
      }, [addToast]);
      
      return <Toast />;
    };

    render(
      <ToastTester>
        <TestComponent />
      </ToastTester>
    );

    const closeButton = screen.getByLabelText('Close toast');
    expect(closeButton).toBeInTheDocument();
    expect(closeButton.textContent).toBe('×');
  });

  it('should have proper toast class structure', () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      
      React.useEffect(() => {
        addToast('Message', 'success');
      }, [addToast]);
      
      return <Toast />;
    };

    const { container } = render(
      <ToastTester>
        <TestComponent />
      </ToastTester>
    );

    const toast = container.querySelector('.toast');
    expect(toast).toHaveClass('toast', 'toast-success');
  });

  it('should render toast message in correct span', () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      
      React.useEffect(() => {
        addToast('Check this message', 'success');
      }, [addToast]);
      
      return <Toast />;
    };

    const { container } = render(
      <ToastTester>
        <TestComponent />
      </ToastTester>
    );

    const messageSpan = container.querySelector('.toast-message');
    expect(messageSpan).toHaveTextContent('Check this message');
  });

  it('should error without provider', () => {
    expect(() => render(<Toast />)).toThrow('useToast must be used within ToastProvider');
  });
});
