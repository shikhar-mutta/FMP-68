import axios from 'axios';

jest.mock('axios');

describe('apiClient service', () => {
  let requestFulfilled;
  let requestRejected;
  let responseFulfilled;
  let responseRejected;
  let mockAxiosInstance;

  beforeAll(() => {
    // Set up the mock axios instance with interceptors
    const requestInterceptors = { use: jest.fn() };
    const responseInterceptors = { use: jest.fn() };

    mockAxiosInstance = {
      interceptors: {
        request: requestInterceptors,
        response: responseInterceptors,
      },
    };

    axios.create.mockReturnValue(mockAxiosInstance);

    // Import the module to initialize interceptors
    require('../../services/api');

    // Capture the interceptor callbacks
    requestFulfilled = requestInterceptors.use.mock.calls[0][0];
    requestRejected = requestInterceptors.use.mock.calls[0][1];
    responseFulfilled = responseInterceptors.use.mock.calls[0][0];
    responseRejected = responseInterceptors.use.mock.calls[0][1];
  });

  beforeEach(() => {
    localStorage.clear();
    delete window.location;
    window.location = { href: '' };
  });

  describe('Exports', () => {
    it('should return apiClient', () => {
      const { default: apiClient } = require('../../services/api');
      expect(apiClient).toBeDefined();
    });

    it('should export API_BASE_URL', () => {
      const { API_BASE_URL } = require('../../services/api');
      expect(API_BASE_URL).toBe('http://localhost:4000');
    });
  });

  describe('Request interceptor', () => {
    it('should add Authorization header when token is present', () => {
      localStorage.setItem('fmp68_token', 'my-test-token');
      const config = { headers: {} };

      const result = requestFulfilled(config);

      expect(result.headers.Authorization).toBe('Bearer my-test-token');
      expect(result).toBe(config);
    });

    it('should not add Authorization header when token is not present', () => {
      const config = { headers: {} };

      const result = requestFulfilled(config);

      expect(result.headers.Authorization).toBeUndefined();
      expect(result).toBe(config);
    });

    it('should pass config through when token exists', () => {
      localStorage.setItem('fmp68_token', 'token123');
      const config = { headers: {}, url: '/test' };

      const result = requestFulfilled(config);

      expect(result).toBe(config);
      expect(result.url).toBe('/test');
      expect(result.headers.Authorization).toBe('Bearer token123');
    });

    it('should handle request errors', async () => {
      const error = new Error('Request failed');

      const promise = requestRejected(error);

      await expect(promise).rejects.toBe(error);
    });

    it('should handle networkerror in request', async () => {
      const error = new Error('Network error');

      await expect(requestRejected(error)).rejects.toBe(error);
    });
  });

  describe('Response interceptor', () => {
    it('should pass through successful responses', () => {
      const response = { status: 200, data: { success: true } };

      const result = responseFulfilled(response);

      expect(result).toBe(response);
      expect(result.status).toBe(200);
    });

    it('should handle 401 Unauthorized by clearing token and redirecting', async () => {
      localStorage.setItem('fmp68_token', 'expired-token');
      const error = { response: { status: 401 } };

      const promise = responseRejected(error);

      expect(localStorage.getItem('fmp68_token')).toBeNull();
      expect(window.location.href).toBe('/login');
      await expect(promise).rejects.toBe(error);
    });

    it('should NOT redirect for 401 when no token in storage', async () => {
      const error = { response: { status: 401 } };

      const promise = responseRejected(error);

      expect(window.location.href).toBe('/login');
      await expect(promise).rejects.toBe(error);
    });

    it('should handle 403 Forbidden without clearing token', async () => {
      localStorage.setItem('fmp68_token', 'valid-token');
      const error = { response: { status: 403 } };

      const promise = responseRejected(error);

      expect(localStorage.getItem('fmp68_token')).toBe('valid-token');
      expect(window.location.href).toBe('');
      await expect(promise).rejects.toBe(error);
    });

    it('should handle 400 Bad Request errors', async () => {
      const error = { response: { status: 400 } };

      const promise = responseRejected(error);

      expect(window.location.href).toBe('');
      await expect(promise).rejects.toBe(error);
    });

    it('should handle 500 Server Error', async () => {
      const error = { response: { status: 500 } };

      const promise = responseRejected(error);

      expect(window.location.href).toBe('');
      await expect(promise).rejects.toBe(error);
    });

    it('should handle errors with no response object', async () => {
      const error = new Error('Network error');

      const promise = responseRejected(error);

      expect(window.location.href).toBe('');
      await expect(promise).rejects.toBe(error);
    });

    it('should handle errors with null response', async () => {
      const error = { response: null };

      const promise = responseRejected(error);

      expect(window.location.href).toBe('');
      await expect(promise).rejects.toBe(error);
    });

    it('should handle errors with undefined response status', async () => {
      const error = { response: { status: undefined } };

      const promise = responseRejected(error);

      expect(window.location.href).toBe('');
      await expect(promise).rejects.toBe(error);
    });

    it('should handle 401 and clear token even if already cleared', async () => {
      const error = { response: { status: 401 } };

      const promise = responseRejected(error);

      expect(localStorage.getItem('fmp68_token')).toBeNull();
      expect(window.location.href).toBe('/login');
      await expect(promise).rejects.toBe(error);
    });
  });
});
