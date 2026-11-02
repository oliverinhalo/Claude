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

describe('Huekeep core loop', () => {
  it('opens on a failing pair with fixes', () => {
    render(<App />);
    expect(screen.getByText('Needs 4.5 : 1')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Use #/ }).length).toBeGreaterThan(0);
  });

  it('applying a fix makes the pair pass', async () => {
    render(<App />);
    const [first] = screen.getAllByRole('button', { name: /^Use #/ });
    if (!first) throw new Error('no fix offered');
    await userEvent.click(first);
    expect(screen.getByText('Passes 4.5 : 1')).toBeInTheDocument();
  });

  it('explains invalid input instead of crashing', async () => {
    render(<App />);
    const field = screen.getByLabelText('Text colour', { selector: 'input[type=text]' });
    await userEvent.clear(field);
    await userEvent.type(field, 'banana');
    expect(screen.getByText(/not a colour I know/)).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });
});
