import { beforeEach, describe, expect, it } from 'vitest';
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

describe('Budgeter', () => {
  beforeEach(() => localStorage.clear());

  it('shows a worked example on first load', () => {
    render(<App />);
    expect(screen.getByTestId('takehome-month').textContent).toMatch(/£2,\d{3}\.\d{2}/);
    expect(screen.getAllByTestId('expense')).toHaveLength(3);
  });

  it('recomputes take-home when the salary changes', async () => {
    render(<App />);
    const salary = screen.getByLabelText(/annual salary/i);
    await userEvent.clear(salary);
    await userEvent.type(salary, '£30,000');
    // £30,000, 5% pension: (30,000 − 1,500 − 3,186 tax − 1,394.40 NI) / 12
    expect(screen.getByTestId('takehome-month').textContent).toMatch(/£1,993\.30/);
  });

  it('shows a shortfall in words when spending exceeds take-home', async () => {
    render(<App />);
    const salary = screen.getByLabelText(/annual salary/i);
    await userEvent.clear(salary);
    await userEvent.type(salary, '10000');
    expect(screen.getByTestId('left-month').textContent).toMatch(/short/);
  });

  it('keeps the last good value and explains a bad one', async () => {
    render(<App />);
    const salary = screen.getByLabelText(/annual salary/i);
    await userEvent.clear(salary);
    await userEvent.type(salary, 'abc');
    expect(screen.getByRole('alert').textContent).toMatch(/Enter a number/);
  });

  it('adds and removes an expense, and persists', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /add an expense/i }));
    expect(screen.getAllByTestId('expense')).toHaveLength(4);
    await userEvent.click(
      screen.getAllByRole('button', { name: /^remove/i })[0] as HTMLElement,
    );
    expect(screen.getAllByTestId('expense')).toHaveLength(3);
    expect(localStorage.getItem('budgeter:state')).not.toBeNull();
  });

  it('shows the empty state with no expenses', async () => {
    render(<App />);
    for (let i = 0; i < 3; i++) {
      await userEvent.click(
        screen.getAllByRole('button', { name: /^remove/i })[0] as HTMLElement,
      );
    }
    expect(screen.getByText(/nothing spent yet/i)).toBeInTheDocument();
  });

  it('recovers from corrupt saved data with a notice', () => {
    localStorage.setItem('budgeter:state', '{{{');
    render(<App />);
    expect(screen.getByText(/could not be read/)).toBeInTheDocument();
    expect(screen.getAllByTestId('expense')).toHaveLength(3);
  });

  it('reset puts the example salary back in the salary box', async () => {
    render(<App />);
    const salary = screen.getByLabelText('Annual salary before tax') as HTMLInputElement;
    await userEvent.clear(salary);
    await userEvent.type(salary, '10000');
    await userEvent.click(screen.getByRole('button', { name: /reset to the example/i }));
    expect(salary.value).toBe('35000');
  });
});
