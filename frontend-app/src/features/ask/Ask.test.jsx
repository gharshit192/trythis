import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Ask from './Ask';
import api from '../../api';

vi.mock('../../api', () => ({ __esModule: true, default: { ask: vi.fn(), getMemories: vi.fn(async () => ({ status: 'success', data: [] })) } }));

const reply = (over = {}) => ({
  status: 'success',
  data: {
    conversationId: 'c1', answer: 'April to June works best.', references: [], followUps: [], usedMemories: [], sources: [],
    ...over,
  },
});

test('shows where a web-backed answer came from', async () => {
  api.ask.mockResolvedValue(reply({
    sources: [{ title: 'Kheerganga seasons', url: 'https://www.thrillophilia.com/kheerganga-trek-weather' }],
  }));
  render(<Ask payload={{ question: 'best time for Kheerganga?' }} onBack={() => {}} onNavigate={() => {}} />);
  expect(await screen.findByText('From the web')).toBeInTheDocument();
  // Shown as the host, and as a real outbound link the user can check.
  const link = screen.getByRole('link', { name: 'thrillophilia.com' });
  expect(link).toHaveAttribute('href', 'https://www.thrillophilia.com/kheerganga-trek-weather');
  expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
});

test('says nothing about the web when the answer came only from saves', async () => {
  api.ask.mockResolvedValue(reply({ sources: [] }));
  render(<Ask payload={{ question: 'what did I save for Kasol?' }} onBack={() => {}} onNavigate={() => {}} />);
  expect(await screen.findByText(/April to June/)).toBeInTheDocument();
  expect(screen.queryByText('From the web')).not.toBeInTheDocument();
});

test('rejoins a bullet the model wrapped mid-sentence', async () => {
  // Real shape from a searched answer: quoted fragments come back with newlines
  // inside them. Split naively this rendered as three chopped lines.
  api.ask.mockResolvedValue(reply({
    answer: '- Rain gear first: carry a \nrain poncho and rain pants\n plus a pack cover.',
  }));
  render(<Ask payload={{ question: 'what should I pack?' }} onBack={() => {}} onNavigate={() => {}} />);
  expect(await screen.findByText(/Rain gear first: carry a rain poncho and rain pants plus a pack cover\./)).toBeInTheDocument();
});

test('keeps separate bullets separate', async () => {
  api.ask.mockResolvedValue(reply({ answer: '- First thing\n- Second thing' }));
  render(<Ask payload={{ question: 'q' }} onBack={() => {}} onNavigate={() => {}} />);
  expect(await screen.findByText('First thing')).toBeInTheDocument();
  expect(screen.getByText('Second thing')).toBeInTheDocument();
});

test('survives a malformed source url rather than blanking the answer', async () => {
  api.ask.mockResolvedValue(reply({ sources: [{ title: 'x', url: 'not-a-url' }] }));
  render(<Ask payload={{ question: 'q' }} onBack={() => {}} onNavigate={() => {}} />);
  expect(await screen.findByText(/April to June/)).toBeInTheDocument();
  expect(screen.getByText('not-a-url')).toBeInTheDocument();
});
