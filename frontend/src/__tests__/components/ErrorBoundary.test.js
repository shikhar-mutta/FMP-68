import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import ErrorBoundary from '../../components/ErrorBoundary';

function Boom({ msg = 'boom' }) {
  throw new Error(msg);
}

function BoomNoMsg() {
  // eslint-disable-next-line no-throw-literal
  throw {};
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy;
  let originalLocation;

  beforeAll(() => {
    originalLocation = window.location;
    delete window.location;
    window.location = { reload: jest.fn(), href: '' };
  });

  afterAll(() => {
    window.location = originalLocation;
  });

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <span>healthy child</span>
      </ErrorBoundary>,
    );
    expect(getByText('healthy child')).toBeTruthy();
  });

  it('renders the error UI with the thrown error message', () => {
    const { container } = render(
      <ErrorBoundary>
        <Boom msg="upstream-died" />
      </ErrorBoundary>,
    );
    expect(container.querySelector('.error-boundary-title').textContent).toBe(
      'Something went wrong',
    );
    expect(container.querySelector('.error-boundary-message').textContent).toBe(
      'upstream-died',
    );
  });

  it('falls back to a generic message when the thrown error has no message', () => {
    const { container } = render(
      <ErrorBoundary>
        <BoomNoMsg />
      </ErrorBoundary>,
    );
    expect(container.querySelector('.error-boundary-message').textContent).toBe(
      'An unexpected error occurred',
    );
  });

  it('reload button calls window.location.reload', () => {
    const { container } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    const [reloadBtn] = container.querySelectorAll('button');
    fireEvent.click(reloadBtn);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('reset button clears state and navigates home', () => {
    const { container, getByText } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    const homeBtn = getByText('Go to home');
    fireEvent.click(homeBtn);
    expect(window.location.href).toBe('/');
  });
});
