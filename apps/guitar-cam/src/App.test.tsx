import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

describe('App shell', () => {
  it('renders exactly one h1', () => {
    render(<App />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('exposes the landmarks the accessibility gate requires', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('offers a skip link as the first focusable element', async () => {
    render(<App />);
    await userEvent.tab();
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveFocus();
  });

  it('cycles the theme and records the choice', async () => {
    render(<App />);
    const toggle = screen.getByRole('button', { name: /theme/i });
    await userEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('light');
    await userEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    await userEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

describe('Guitar Cam states', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('starts empty, with the demo on offer and nothing recorded', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /^listen$/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /try the demo/i })).toBeEnabled();
    expect(screen.getByText(/nothing recorded yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^record$/i })).toBeDisabled();
  });

  it('names the cause when the microphone is blocked, and keeps the demo', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        getUserMedia: () => Promise.reject(new DOMException('no', 'NotAllowedError')),
      },
    });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /^listen$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/blocked/i);
    expect(screen.getByRole('button', { name: /try the demo/i })).toBeEnabled();
  });

  it('says so when there is no microphone API at all', async () => {
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /^listen$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/secure/i);
  });

  it('recovers from corrupt saved data and says so', async () => {
    localStorage.setItem('guitar-cam:state', '{"v":1,"d":{"tuning":"nope"}}');
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByText(/could not be read, so guitar cam started fresh/i),
      ).toBeInTheDocument(),
    );
  });

  it('releases a microphone that arrives after the demo has taken over', async () => {
    let grant: (stream: MediaStream) => void = () => undefined;
    const stopTrack = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        getUserMedia: () =>
          new Promise<MediaStream>((resolve) => {
            grant = resolve;
          }),
      },
    });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /^listen$/i }));
    expect(screen.getByTestId('status')).toHaveTextContent(/waiting for microphone/i);
    await userEvent.click(screen.getByRole('button', { name: /try the demo/i }));
    grant({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream);
    await waitFor(() => expect(stopTrack).toHaveBeenCalled());
    expect(screen.getByTestId('status')).toHaveTextContent(/demo/i);
    await userEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    expect(screen.getByTestId('status')).toHaveTextContent(/not listening/i);
  });
});
