import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`no item at ${i}`);
  return v;
}

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/');
});

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

describe('Roomwise', () => {
  it('shows the example split on first load, adding up to the rent', () => {
    render(<App />);
    const amounts = screen
      .getAllByLabelText(/^Share for/)
      .map((e) => Number((e.textContent ?? '').replace(/[^0-9.]/g, '')));
    expect(amounts).toHaveLength(3);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(2100);
  });

  it('updates when a perk is ticked', async () => {
    render(<App />);
    const before = screen.getByLabelText('Share for Middle room').textContent;
    const boxes = screen.getAllByRole('checkbox', { name: /Ensuite bathroom/ });
    await userEvent.click(at(boxes, 1));
    expect(screen.getByLabelText('Share for Middle room').textContent).not.toBe(before);
  });

  it('asks for rent instead of showing NaN', async () => {
    render(<App />);
    await userEvent.clear(screen.getByLabelText('Total rent per month'));
    expect(screen.getAllByText(/total monthly rent/i).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/NaN/);
  });

  it('adds and removes rooms, and recovers from none', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Add a room' }));
    expect(screen.getAllByLabelText(/^Share for/)).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      await userEvent.click(at(screen.getAllByRole('button', { name: /^Remove/ }), 0));
    }
    expect(screen.getByRole('button', { name: 'Add the first room' })).toBeInTheDocument();
  });

  it('tells the user when saved data was corrupt', () => {
    localStorage.setItem('roomwise:state', 'garbage');
    render(<App />);
    expect(screen.getByText(/could not be restored/)).toBeInTheDocument();
  });
});
