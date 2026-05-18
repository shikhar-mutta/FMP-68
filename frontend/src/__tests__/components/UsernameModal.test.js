import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react';
import axios from 'axios';
import UsernameModal from '../../components/UsernameModal';

jest.mock('axios');

const mockRefreshUser = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ refreshUser: mockRefreshUser }),
}));

describe('UsernameModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('fmp68_token', 'tok-abc');
    axios.patch = jest.fn();
  });

  it('renders the modal with the title + form', () => {
    const { container } = render(<UsernameModal />);
    expect(container.querySelector('.username-modal-title').textContent).toBe(
      'Choose a username',
    );
    expect(container.querySelector('.username-input')).toBeTruthy();
  });

  it('keeps the submit button disabled until input is 3+ chars', () => {
    const { container } = render(<UsernameModal />);
    const button = container.querySelector('button.username-modal-btn');
    const input = container.querySelector('.username-input');
    expect(button.disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'ab' } });
    expect(button.disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(button.disabled).toBe(false);
  });

  it('shows the format-error message when the username fails regex', async () => {
    const { container } = render(<UsernameModal />);
    const input = container.querySelector('.username-input');
    fireEvent.change(input, { target: { value: 'has-dashes' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => {
      expect(container.querySelector('.username-error').textContent).toMatch(
        /3–20 chars/,
      );
    });
    expect(axios.patch).not.toHaveBeenCalled();
  });

  it('submits a clean username and triggers refreshUser on success', async () => {
    axios.patch.mockResolvedValue({ data: { id: 'u1', username: 'goodname' } });
    const { container } = render(<UsernameModal />);
    fireEvent.change(container.querySelector('.username-input'), {
      target: { value: '  GoodName  ' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form'));
    });

    expect(axios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/users/me/username'),
      { username: 'goodname' },
      { headers: { Authorization: 'Bearer tok-abc' } },
    );
    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalled());
  });

  it('surfaces the server message on failure (string body)', async () => {
    axios.patch.mockRejectedValue({
      response: { data: { message: 'Username is taken' } },
    });
    const { container } = render(<UsernameModal />);
    fireEvent.change(container.querySelector('.username-input'), {
      target: { value: 'someone' },
    });
    await act(async () => {
      fireEvent.submit(container.querySelector('form'));
    });
    await waitFor(() => {
      expect(container.querySelector('.username-error').textContent).toBe(
        'Username is taken',
      );
    });
  });

  it('joins validation arrays into a single error message', async () => {
    axios.patch.mockRejectedValue({
      response: { data: { message: ['too short', 'bad chars'] } },
    });
    const { container } = render(<UsernameModal />);
    fireEvent.change(container.querySelector('.username-input'), {
      target: { value: 'someone' },
    });
    await act(async () => {
      fireEvent.submit(container.querySelector('form'));
    });
    await waitFor(() => {
      expect(container.querySelector('.username-error').textContent).toBe(
        'too short, bad chars',
      );
    });
  });

  it('falls back to a generic error when the server says nothing useful', async () => {
    axios.patch.mockRejectedValue({});
    const { container } = render(<UsernameModal />);
    fireEvent.change(container.querySelector('.username-input'), {
      target: { value: 'someone' },
    });
    await act(async () => {
      fireEvent.submit(container.querySelector('form'));
    });
    await waitFor(() => {
      expect(container.querySelector('.username-error').textContent).toBe(
        'Something went wrong',
      );
    });
  });

  it('clears any prior error when the user edits the input', async () => {
    const { container } = render(<UsernameModal />);
    const input = container.querySelector('.username-input');
    fireEvent.change(input, { target: { value: 'bad-name' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => {
      expect(container.querySelector('.username-error')).toBeTruthy();
    });

    fireEvent.change(input, { target: { value: 'cleaner' } });
    expect(container.querySelector('.username-error')).toBeFalsy();
  });
});
