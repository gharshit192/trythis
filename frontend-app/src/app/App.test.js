import { render, screen } from '@testing-library/react';
import App from './App';

// The shell's only synchronous promise: with no stored session it must land on
// the welcome screen rather than flashing an authed screen or a blank frame.
test('shows the welcome screen when there is no stored session', () => {
  localStorage.clear();
  render(<App />);
  expect(screen.getByRole('heading', { name: /everything you saved/i })).toBeInTheDocument();
});
