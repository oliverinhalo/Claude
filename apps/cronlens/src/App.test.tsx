import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('App shell', () => {
  it('renders exactly one h1 and the landmarks', () => {
    render(<App />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
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
    await userEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

describe('Cronlens', () => {
  it('opens on the New York example with a skipped run reported', () => {
    render(<App />);
    expect(screen.getByLabelText('Cron expression')).toHaveValue('30 2 * * *');
    expect(screen.getByLabelText('Time zone')).toHaveValue('America/New_York');
    expect(
      screen.getByRole('heading', { name: /skip or repeat|skips or repeats/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/does not exist/)).toBeInTheDocument();
  });

  it('shows ten runs', () => {
    render(<App />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(11);
  });

  it('explains a bad expression next to the field and drops the stale results', async () => {
    render(<App />);
    const input = screen.getByLabelText('Cron expression');
    await userEvent.clear(input);
    await userEvent.type(input, '61 * * * *');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/outside the minute range 0–59/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('reads the expression in plain English', async () => {
    render(<App />);
    const input = screen.getByLabelText('Cron expression');
    await userEvent.clear(input);
    await userEvent.type(input, '0 9 * * 1-5');
    expect(screen.getByText('At 09:00, Monday through Friday')).toBeInTheDocument();
  });

  it('says none for a zone without clock changes', async () => {
    render(<App />);
    await userEvent.selectOptions(screen.getByLabelText('Time zone'), 'Asia/Kolkata');
    expect(screen.getByRole('heading', { name: /none/ })).toBeInTheDocument();
  });

  it('restores state from the link and warns about an unknown zone', () => {
    window.history.replaceState(null, '', '#c=0+9+*+*+*&z=Mars%2FOlympus');
    render(<App />);
    expect(screen.getByLabelText('Cron expression')).toHaveValue('0 9 * * *');
    expect(screen.getByRole('status')).toHaveTextContent('Mars/Olympus');
  });

  it('survives corrupt stored state', () => {
    localStorage.setItem('cronlens:state', '{{{ not json');
    render(<App />);
    expect(screen.getByLabelText('Cron expression')).toHaveValue('30 2 * * *');
  });

  it('applies an example chip', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Lord Howe/ }));
    expect(screen.getByLabelText('Cron expression')).toHaveValue('*/15 * * * *');
    expect(screen.getByLabelText('Time zone')).toHaveValue('Australia/Lord_Howe');
  });
});
