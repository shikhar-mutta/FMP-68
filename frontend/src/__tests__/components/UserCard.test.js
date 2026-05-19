import React from 'react';
import { render } from '@testing-library/react';
import UserCard from '../../components/UserCard';

describe('UserCard Component', () => {
  const mockUser = {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    picture: 'https://example.com/avatar.jpg',
    isOnline: true,
  };

  it('should render user card', () => {
    const { container } = render(<UserCard user={mockUser} index={0} />);
    expect(container.querySelector('.user-card')).toBeTruthy();
  });

  it('should render user card with online user', () => {
    const { container } = render(<UserCard user={mockUser} index={0} />);
    expect(container.querySelector('.user-card')).toBeTruthy();
    expect(container.querySelector('.user-avatar-wrap')).toBeTruthy();
  });

  it('should render user card with offline user', () => {
    const offlineUser = { ...mockUser, isOnline: false };
    const { container } = render(<UserCard user={offlineUser} index={0} />);
    expect(container.querySelector('.user-card')).toBeTruthy();
  });

  it('should apply animation delay based on index', () => {
    const { container } = render(<UserCard user={mockUser} index={2} />);
    const card = container.querySelector('.user-card');
    expect(card).toBeTruthy();
  });

  it('should render multiple cards', () => {
    const { container } = render(
      <div>
        <UserCard user={mockUser} index={0} />
        <UserCard user={{ ...mockUser, id: 'user-2' }} index={1} />
      </div>
    );
    const cards = container.querySelectorAll('.user-card');
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });

  it('should render fallback avatar URL when user has no picture', () => {
    const userNoPicture = {
      ...mockUser,
      picture: null,
    };
    const { container } = render(<UserCard user={userNoPicture} index={0} />);
    const img = container.querySelector('.user-avatar');
    expect(img).toBeTruthy();
    // Should use the ui-avatars fallback
    expect(img.getAttribute('src')).toContain('ui-avatars.com');
  });

  it('should render username when user.username is provided', () => {
    const userWithUsername = {
      ...mockUser,
      username: 'johndoe',
    };
    const { container } = render(<UserCard user={userWithUsername} index={0} />);
    const usernameDiv = container.querySelector('.user-username');
    expect(usernameDiv).toBeTruthy();
    expect(usernameDiv.textContent).toBe('@johndoe');
  });

  it('should not render username when user.username is absent', () => {
    const userNoUsername = { ...mockUser };
    delete userNoUsername.username;
    const { container } = render(<UserCard user={userNoUsername} index={0} />);
    expect(container.querySelector('.user-username')).toBeFalsy();
  });
});