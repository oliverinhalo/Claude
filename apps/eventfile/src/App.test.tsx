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

  it('shows an example event with dates and a file on first load', () => {
    render(<App />);
    expect(screen.getByLabelText('Title')).toHaveValue('Committee meeting');
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByLabelText('Calendar file contents').textContent).toContain(
      'BEGIN:VCALENDAR',
    );
  });

  it('blocks download and names the field when the title is empty', async () => {
    render(<App />);
    await userEvent.clear(screen.getByLabelText('Title'));
    expect(screen.getByText('Give the event a title.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download/i })).toBeDisabled();
    expect(screen.getByLabelText('Calendar file contents').textContent).toBe(
      'Nothing to show yet.',
    );
  });

  it('recovers from corrupt stored data with a notice', () => {
    localStorage.setItem('eventfile:state', '{{garbage');
    render(<App />);
    expect(screen.getAllByRole('status')[0]?.textContent).toContain('could not be read');
    expect(screen.getByLabelText('Title')).toHaveValue('Committee meeting');
  });
});
