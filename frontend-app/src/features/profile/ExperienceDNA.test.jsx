import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ExperienceDNA from './ExperienceDNA';
import api from '../../api';

vi.mock('../../api', () => ({ __esModule: true, default: { getDna: vi.fn() } }));

const ok = (data) => ({ status: 'success', data });

// §44 forbids presenting weak data as fact, so the screen must be able to show
// nothing — and must never describe an inference as something the user said.
test('says it does not know yet rather than guessing', async () => {
  api.getDna.mockResolvedValue(ok({ ready: false, traits: [], notEnough: ['trek'], counts: {}, windowDays: 90 }));
  render(<ExperienceDNA onBack={() => {}} />);
  expect(await screen.findByText(/Not yet/i)).toBeInTheDocument();
  expect(screen.queryByText(/What we.*worked out/i)).not.toBeInTheDocument();
});

test('shows traits with the evidence behind them once there is enough', async () => {
  api.getDna.mockResolvedValue(ok({
    ready: true, windowDays: 90, counts: { saves: 12, tried: 4 }, notEnough: [],
    traits: [{ label: 'quiet cafes', subject: 'cafe', strength: 0.8, level: 'Strong', basis: 'observed', because: { said: 0, saved: 12, tried: 4, disliked: 0 } }],
  }));
  render(<ExperienceDNA onBack={() => {}} />);
  expect(await screen.findByText('quiet cafes')).toBeInTheDocument();
  expect(screen.getByText('Strong')).toBeInTheDocument();
  expect(screen.getByText(/We noticed this/)).toBeInTheDocument();
});

test('an inferred trait is never worded as something the user said', async () => {
  api.getDna.mockResolvedValue(ok({
    ready: true, windowDays: 90, counts: { saves: 5, tried: 0 }, notEnough: [],
    traits: [{ label: 'street food', subject: 'street food', strength: 0.5, level: 'Some', basis: 'observed', because: { said: 0, saved: 5, tried: 0, disliked: 0 } }],
  }));
  render(<ExperienceDNA onBack={() => {}} />);
  await screen.findByText('street food');
  expect(screen.queryByText(/You told me/)).not.toBeInTheDocument();
});

test('a stated trait says so', async () => {
  api.getDna.mockResolvedValue(ok({
    ready: true, windowDays: 90, counts: { saves: 2, tried: 1 }, notEnough: [],
    traits: [{ label: 'loves treks', subject: 'treks', strength: 1, level: 'Strong', basis: 'stated', because: { said: 3, saved: 2, tried: 1, disliked: 0 } }],
  }));
  render(<ExperienceDNA onBack={() => {}} />);
  expect(await screen.findByText(/You told me/)).toBeInTheDocument();
});

test('recovers when the request fails', async () => {
  api.getDna.mockRejectedValue(new Error('offline'));
  render(<ExperienceDNA onBack={() => {}} />);
  await waitFor(() => expect(screen.getByText(/could not work that out/i)).toBeInTheDocument());
});
