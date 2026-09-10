import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompleteYourTrip from './CompleteYourTrip';
import SavedMerchant from './SavedMerchant';
import api from '../../api';
vi.mock('../../api', () => ({ __esModule: true, default: { getTripOffers: vi.fn() } }));
const offer = { provider: 'links', title: 'Find stays for Goa', source: 'utility', href: '/go/test', options: [{ provider: 'ITC Hotels', href: '/go/itc' }] };
beforeEach(() => { api.getTripOffers.mockReset(); });
test('trip options are clearly deferred without booking controls or offer requests', () => {
  render(<CompleteYourTrip />);
  for (const label of ['Hotels', 'Buses', 'Flights']) expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getAllByText('Coming soon')).toHaveLength(3);
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByLabelText('Check-in')).toBeNull();
  expect(api.getTripOffers).not.toHaveBeenCalled();
});
test('Nykaa is shown only for an actual saved Nykaa URL', async () => {
  api.getTripOffers.mockResolvedValue({ data: { products: [{ ...offer, provider: 'Nykaa', title: 'View your saved item on Nykaa' }] } });
  const view = render(<SavedMerchant save={{ _id: 'one', url: 'https://example.com/' }} />);
  expect(api.getTripOffers).not.toHaveBeenCalled();
  view.rerender(<SavedMerchant save={{ _id: 'two', url: 'https://www.nykaa.com/p/123' }} />);
  await screen.findByText('View your saved item on Nykaa');
});
