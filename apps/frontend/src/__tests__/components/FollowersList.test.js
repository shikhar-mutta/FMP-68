import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import FollowersList from '../../components/FollowersList';

jest.mock('../../styles/FollowersList.css', () => ({}));

describe('FollowersList', () => {
  const followers = [
    { id: 'user-1', name: 'John', email: 'john@test.com', picture: '' },
    { id: 'user-2', name: 'Jane', email: 'jane@test.com', picture: 'http://example.com/jane.png' },
  ];

  beforeEach(() => {
    window.showToast = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    delete window.showToast;
    console.error.mockRestore();
  });

  it('shows loading state', () => {
    const { container } = render(<FollowersList followers={[]} loading />);
    expect(container.querySelector('.spinner-small')).toBeTruthy();
  });

  it('shows empty state when no followers', () => {
    const { container } = render(<FollowersList followers={[]} />);
    expect(container.querySelector('.followers-empty')).toBeTruthy();
  });

  it('renders followers list with fallback avatar', () => {
    const { container } = render(<FollowersList followers={followers} />);
    expect(container.querySelectorAll('.follower-item').length).toBe(2);
    expect(container.querySelector('.follower-avatar-fallback')).toBeTruthy();
  });

  it('renders follower image when picture provided', () => {
    const { container } = render(<FollowersList followers={followers} />);
    const img = container.querySelector('img.follower-avatar[alt="Jane"]');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('http://example.com/jane.png');
  });

  it('shows remove button when publisher', () => {
    const { container } = render(
      <FollowersList followers={followers} isPublisher onRemoveFollower={jest.fn()} />
    );
    expect(container.querySelector('.btn-remove-follower')).toBeTruthy();
  });

  it('opens confirmation modal on remove click', () => {
    const { container } = render(
      <FollowersList followers={followers} isPublisher onRemoveFollower={jest.fn()} />
    );
    fireEvent.click(container.querySelector('.btn-remove-follower'));
    expect(container.querySelector('.confirmation-modal-overlay')).toBeTruthy();
  });

  it('closes confirmation modal on cancel', () => {
    const { container } = render(
      <FollowersList followers={followers} isPublisher onRemoveFollower={jest.fn()} />
    );
    fireEvent.click(container.querySelector('.btn-remove-follower'));
    fireEvent.click(container.querySelector('.btn-cancel-confirm'));
    expect(container.querySelector('.confirmation-modal-overlay')).toBeFalsy();
  });

  it('confirms remove and calls onRemoveFollower', async () => {
    const onRemoveFollower = jest.fn().mockResolvedValue({});
    const { container } = render(
      <FollowersList followers={followers} isPublisher onRemoveFollower={onRemoveFollower} />
    );
    fireEvent.click(container.querySelector('.btn-remove-follower'));
    fireEvent.click(container.querySelector('.btn-confirm-remove'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(onRemoveFollower).toHaveBeenCalledWith('user-1');
    expect(window.showToast).toHaveBeenCalled();
  });

  it('confirms remove without showToast', async () => {
    const onRemoveFollower = jest.fn().mockResolvedValue({});
    delete window.showToast;
    const { container } = render(
      <FollowersList followers={followers} isPublisher onRemoveFollower={onRemoveFollower} />
    );
    fireEvent.click(container.querySelector('.btn-remove-follower'));
    fireEvent.click(container.querySelector('.btn-confirm-remove'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(onRemoveFollower).toHaveBeenCalledWith('user-1');
  });

  it('does not call remove when confirmation is missing', async () => {
    const onRemoveFollower = jest.fn().mockResolvedValue({});
    const { container } = render(
      <FollowersList followers={followers} isPublisher onRemoveFollower={onRemoveFollower} />
    );
    const { container: emptyContainer } = render(
      <FollowersList followers={followers} isPublisher onRemoveFollower={onRemoveFollower} />
    );

    await act(async () => {
      const missingConfirm = emptyContainer.querySelector('.btn-confirm-remove');
      if (missingConfirm) {
        fireEvent.click(missingConfirm);
      }
    });

    expect(onRemoveFollower).not.toHaveBeenCalled();
  });

  it('handles remove error and shows toast', async () => {
    const onRemoveFollower = jest.fn().mockRejectedValue(new Error('fail'));
    const { container } = render(
      <FollowersList followers={followers} isPublisher onRemoveFollower={onRemoveFollower} />
    );
    fireEvent.click(container.querySelector('.btn-remove-follower'));
    fireEvent.click(container.querySelector('.btn-confirm-remove'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(console.error).toHaveBeenCalled();
    expect(window.showToast).toHaveBeenCalledWith('Failed to remove follower: fail', 'error');
  });

  it('handles remove error without showToast', async () => {
    delete window.showToast;
    const onRemoveFollower = jest.fn().mockRejectedValue(new Error('fail'));
    const { container } = render(
      <FollowersList followers={followers} isPublisher onRemoveFollower={onRemoveFollower} />
    );
    fireEvent.click(container.querySelector('.btn-remove-follower'));
    fireEvent.click(container.querySelector('.btn-confirm-remove'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(console.error).toHaveBeenCalled();
  });

  it('renders fallback avatar when name missing', () => {
    const followersWithoutName = [{ id: 'user-3', name: '', email: 'unknown@test.com', picture: '' }];
    const { container } = render(<FollowersList followers={followersWithoutName} />);
    expect(container.querySelector('.follower-avatar-fallback')?.textContent).toBe('?');
    expect(container.querySelector('.follower-name')?.textContent).toBe('Unknown User');
  });

  it('disables remove button while removing', async () => {
    const onRemoveFollower = jest.fn(
      () => new Promise((resolve) => setTimeout(resolve, 50))
    );
    const { container } = render(
      <FollowersList followers={followers} isPublisher onRemoveFollower={onRemoveFollower} />
    );

    fireEvent.click(container.querySelector('.btn-remove-follower'));
    const confirmBtn = container.querySelector('.btn-confirm-remove');
    fireEvent.click(confirmBtn);

    const removeBtn = container.querySelector('.btn-remove-follower');
    expect(removeBtn.disabled).toBe(true);
  });
});
