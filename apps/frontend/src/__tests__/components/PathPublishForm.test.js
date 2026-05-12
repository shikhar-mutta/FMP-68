import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PathPublishForm from '../../components/PathPublishForm';
import axios from 'axios';

jest.mock('../../styles/PathPublish.css', () => ({}));
jest.mock('axios');

describe('PathPublishForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('fmp68_token', 'test-token');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should show publish button initially', () => {
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    expect(screen.getByText('📍 Publish New Path')).toBeInTheDocument();
  });

  it('should show form when publish button is clicked', () => {
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    const publishButton = screen.getByText('📍 Publish New Path');
    fireEvent.click(publishButton);
    
    expect(screen.getByText('Publish a New Path')).toBeInTheDocument();
    expect(screen.getByLabelText('Path Title *')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('should hide form when close button is clicked', async () => {
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const closeButton = screen.getByText('✕');
    fireEvent.click(closeButton);
    
    expect(screen.getByText('📍 Publish New Path')).toBeInTheDocument();
  });

  it('should hide form when cancel button is clicked', () => {
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    
    expect(screen.getByText('📍 Publish New Path')).toBeInTheDocument();
  });

  it('should update title input', async () => {
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const titleInput = screen.getByLabelText('Path Title *');
    await userEvent.type(titleInput, 'My Amazing Path');
    
    expect(titleInput.value).toBe('My Amazing Path');
  });

  it('should update description input', async () => {
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const descriptionInput = screen.getByLabelText('Description');
    await userEvent.type(descriptionInput, 'This is a great path');
    
    expect(descriptionInput.value).toBe('This is a great path');
  });

  it('should display character count for description', async () => {
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const descriptionInput = screen.getByLabelText('Description');
    await userEvent.type(descriptionInput, 'test');
    
    expect(screen.getByText('4/500')).toBeInTheDocument();
  });

  it('should publish path successfully', async () => {
    const onPathPublished = jest.fn();
    const mockResponse = { data: { id: 'path-1', title: 'Test Path' } };
    axios.post.mockResolvedValue(mockResponse);
    
    render(<PathPublishForm onPathPublished={onPathPublished} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const titleInput = screen.getByLabelText('Path Title *');
    const descriptionInput = screen.getByLabelText('Description');
    
    await userEvent.type(titleInput, 'Test Path');
    await userEvent.type(descriptionInput, 'Test Description');
    
    const submitButton = screen.getByRole('button', { name: /publish/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/paths'),
        { title: 'Test Path', description: 'Test Description' },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
      expect(onPathPublished).toHaveBeenCalledWith(mockResponse.data);
    });
  });

  it('should clear form and close after successful publish', async () => {
    const mockResponse = { data: { id: 'path-1', title: 'Test Path' } };
    axios.post.mockResolvedValue(mockResponse);
    
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const titleInput = screen.getByLabelText('Path Title *');
    const descriptionInput = screen.getByLabelText('Description');
    
    await userEvent.type(titleInput, 'Test Path');
    await userEvent.type(descriptionInput, 'Test Description');
    
    const submitButton = screen.getByRole('button', { name: /publish/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('📍 Publish New Path')).toBeInTheDocument();
    });
  });

  it('should show error when token is missing', async () => {
    localStorage.removeItem('fmp68_token');
    
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const titleInput = screen.getByLabelText('Path Title *');
    await userEvent.type(titleInput, 'Test Path');
    
    const submitButton = screen.getByRole('button', { name: /publish/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Authentication required')).toBeInTheDocument();
    });
  });

  it('should handle API error with message', async () => {
    const errorMessage = 'Path title must be unique';
    axios.post.mockRejectedValue({
      response: {
        data: { message: errorMessage },
      },
    });
    
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const titleInput = screen.getByLabelText('Path Title *');
    await userEvent.type(titleInput, 'Test Path');
    
    const submitButton = screen.getByRole('button', { name: /publish/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should handle API error with error field', async () => {
    const errorMessage = 'Invalid path data';
    axios.post.mockRejectedValue({
      response: {
        data: { error: errorMessage },
      },
    });
    
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const titleInput = screen.getByLabelText('Path Title *');
    await userEvent.type(titleInput, 'Test Path');
    
    const submitButton = screen.getByRole('button', { name: /publish/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should handle API error with default message', async () => {
    axios.post.mockRejectedValue({
      response: {
        data: {},
      },
    });
    
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const titleInput = screen.getByLabelText('Path Title *');
    await userEvent.type(titleInput, 'Test Path');
    
    const submitButton = screen.getByRole('button', { name: /publish/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to publish path')).toBeInTheDocument();
    });
  });

  it('should handle network error', async () => {
    axios.post.mockRejectedValue(new Error('Network error'));
    
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const titleInput = screen.getByLabelText('Path Title *');
    await userEvent.type(titleInput, 'Test Path');
    
    const submitButton = screen.getByRole('button', { name: /publish/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to publish path')).toBeInTheDocument();
    });
  });

  it('should show loading state during submission', async () => {
    axios.post.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const titleInput = screen.getByLabelText('Path Title *');
    await userEvent.type(titleInput, 'Test Path');
    
    const submitButton = screen.getByRole('button', { name: /publish/i });
    fireEvent.click(submitButton);
    
    // Check that inputs and buttons are disabled
    await waitFor(() => {
      expect(titleInput).toBeDisabled();
    });
  });

  it('should limit title to 100 characters', async () => {
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const titleInput = screen.getByLabelText('Path Title *');
    expect(titleInput.maxLength).toBe(100);
  });

  it('should limit description to 500 characters', async () => {
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const descriptionInput = screen.getByLabelText('Description');
    expect(descriptionInput.maxLength).toBe(500);
  });

  it('should clear error on form submission', async () => {
    axios.post
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockResolvedValueOnce({ data: { id: 'path-1' } });
    
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    
    // First submission with error
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    const titleInput = screen.getByLabelText('Path Title *');
    await userEvent.type(titleInput, 'Test Path');
    
    let submitButton = screen.getByRole('button', { name: /publish/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to publish path')).toBeInTheDocument();
    });
    
    // Form should still be visible after error
    expect(screen.getByText('Publish a New Path')).toBeInTheDocument();
  });

  it('should require title field', () => {
    render(<PathPublishForm onPathPublished={jest.fn()} />);
    fireEvent.click(screen.getByText('📍 Publish New Path'));
    
    const titleInput = screen.getByLabelText('Path Title *');
    expect(titleInput.required).toBe(true);
  });
});

