import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

describe('App', () => {
  it('asks for a token when none is stored', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: /connect your factory/i }),
    ).toBeInTheDocument();
  });

  it('keeps Connect disabled until the token looks plausible', async () => {
    render(<App />);
    const connect = screen.getByRole('button', { name: /connect/i });
    expect(connect).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/^token$/i), 'github_pat_11ABCDEFG0123456789');
    expect(connect).toBeEnabled();
  });

  it('rejects a malformed repository', async () => {
    render(<App />);
    const repo = screen.getByLabelText(/factory repository/i);
    await userEvent.clear(repo);
    await userEvent.type(repo, 'not-a-repo');
    await userEvent.type(screen.getByLabelText(/^token$/i), 'github_pat_11ABCDEFG0123456789');
    expect(screen.getByRole('button', { name: /connect/i })).toBeDisabled();
  });

  it('exposes the landmarks the accessibility gate requires', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('does not render the token as readable text', async () => {
    render(<App />);
    const field = screen.getByLabelText(/^token$/i);
    expect(field).toHaveAttribute('type', 'password');
  });
});
