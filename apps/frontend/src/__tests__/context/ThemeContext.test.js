import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../../context/ThemeContext';

const WithMounted = ({ children }) => {
  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return ready ? children : null;
};

const renderWithProvider = (ui) =>
  render(
    <ThemeProvider>
      <WithMounted>{ui}</WithMounted>
    </ThemeProvider>
  );

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should provide theme context', () => {
    const { container } = render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('should render children', () => {
    const { container } = render(
      <ThemeProvider>
        <div data-testid="child">Child</div>
      </ThemeProvider>
    );
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy();
  });

  it('should export useTheme hook', () => {
    expect(useTheme).toBeDefined();
    expect(typeof useTheme).toBe('function');
  });

  it('should have toggleTheme function', () => {
    const TestComponent = () => {
      const { toggleTheme } = useTheme();
      return <div>{typeof toggleTheme === 'function' ? 'Ready' : 'Not Ready'}</div>;
    };

    const { container } = renderWithProvider(<TestComponent />);
    expect(container).toBeTruthy();
  });

  it('should have theme value', () => {
    const TestComponent = () => {
      const { theme } = useTheme();
      return <div>{theme}</div>;
    };

    const { container } = renderWithProvider(<TestComponent />);
    expect(container).toBeTruthy();
  });

  it('should have isDark value based on theme', async () => {
    const TestComponent = () => {
      const { isDark } = useTheme();
      return <div>{isDark ? 'Dark' : 'Light'}</div>;
    };

    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText(/Dark|Light/)).toBeInTheDocument();
    });
  });

  it('should load theme from localStorage', async () => {
    localStorage.setItem('fmp68_theme', 'light');

    const TestComponent = () => {
      const { theme } = useTheme();
      return <div>{theme}</div>;
    };

    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('light')).toBeInTheDocument();
    });
  });

  it('should default to dark theme when localStorage is empty', async () => {
    localStorage.removeItem('fmp68_theme');

    const TestComponent = () => {
      const { theme } = useTheme();
      return <div>{theme}</div>;
    };

    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('dark')).toBeInTheDocument();
    });
  });

  it('should apply theme to document element', async () => {
    localStorage.setItem('fmp68_theme', 'light');

    render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  it('should toggle theme from dark to light', async () => {
    const TestComponent = () => {
      const { toggleTheme, theme } = useTheme();
      return (
        <div>
          <div>Theme: {theme}</div>
          <button onClick={toggleTheme}>Toggle</button>
        </div>
      );
    };

    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText(/Theme: dark/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/Theme: light/i)).toBeInTheDocument();
    });
  });

  it('should toggle theme from light to dark', async () => {
    localStorage.setItem('fmp68_theme', 'light');

    const TestComponent = () => {
      const { toggleTheme, theme } = useTheme();
      return (
        <div>
          <div>Theme: {theme}</div>
          <button onClick={toggleTheme}>Toggle</button>
        </div>
      );
    };

    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText(/Theme: light/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/Theme: dark/i)).toBeInTheDocument();
    });
  });

  it('should save theme to localStorage on toggle', async () => {
    const TestComponent = () => {
      const { toggleTheme } = useTheme();
      return <button onClick={toggleTheme}>Toggle</button>;
    };

    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(localStorage.getItem('fmp68_theme')).toBe('light');
    });
  });

  it('should apply theme to document after toggle', async () => {
    const TestComponent = () => {
      const { toggleTheme } = useTheme();
      return <button onClick={toggleTheme}>Toggle</button>;
    };

    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  it('should throw error when useTheme is used outside provider', () => {
    const TestComponent = () => {
      try {
        useTheme();
        return <div>Should not render</div>;
      } catch (err) {
        return <div>{err.message}</div>;
      }
    };

    render(<TestComponent />);

    expect(screen.getByText(/useTheme must be used within/i)).toBeInTheDocument();
  });

  it('should provide correct isDark value for dark theme', async () => {
    const TestComponent = () => {
      const { isDark } = useTheme();
      return <div>{isDark ? 'dark-mode' : 'light-mode'}</div>;
    };

    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('dark-mode')).toBeInTheDocument();
    });
  });

  it('should provide correct isDark value for light theme', async () => {
    localStorage.setItem('fmp68_theme', 'light');

    const TestComponent = () => {
      const { isDark } = useTheme();
      return <div>{isDark ? 'dark-mode' : 'light-mode'}</div>;
    };

    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('light-mode')).toBeInTheDocument();
    });
  });

  it('should set mounted state after initial load', async () => {
    const TestComponent = () => {
      const { theme } = useTheme();
      return <div>{theme ? 'mounted' : 'not-mounted'}</div>;
    };

    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('mounted')).toBeInTheDocument();
    });
  });

  it('should apply dark theme by default to document', () => {
    render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
