import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('Crumb Clock core loop', () => {
  it('shows a full schedule on load with no input', () => {
    localStorage.clear();
    window.location.hash = '';
    render(<App />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8);
    expect(
      screen.getByRole('heading', { name: /start feeding your starter|not enough time/i }),
    ).toBeInTheDocument();
  });

  it('switching to overnight adds the cold proof', async () => {
    localStorage.clear();
    render(<App />);
    await userEvent.click(screen.getByRole('radio', { name: /overnight/i }));
    expect(screen.getByRole('heading', { name: /cold proof/i })).toBeInTheDocument();
  });

  it('restores a shared plan from the URL hash', () => {
    window.location.hash = '#t=30000000&m=o&c=19';
    render(<App />);
    expect(screen.getByRole('radio', { name: /overnight/i })).toBeChecked();
    window.location.hash = '';
  });

  it('recovers from corrupt saved settings with a visible note', () => {
    localStorage.setItem('crumb-clock:state', '{{{');
    window.location.hash = '';
    render(<App />);
    expect(screen.getByText(/started fresh/i)).toBeInTheDocument();
  });
});
