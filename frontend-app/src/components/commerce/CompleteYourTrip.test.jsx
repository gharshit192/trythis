import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CompleteYourTrip from './CompleteYourTrip';
import SavedMerchant from './SavedMerchant';
import api from '../../api';
jest.mock('../../api', () => ({ __esModule: true, default: { getTripOffers: jest.fn() } }));
const offer = { provider: 'links', title: 'Find stays for Goa', source: 'utility', href: '/go/test', options: [{ provider: 'ITC Hotels', href: '/go/itc' }] };
beforeEach(() => { api.getTripOffers.mockReset(); });
test('renders merchant links, activities and direct-link disclosure without live-price claims', async () => {
  api.getTripOffers.mockResolvedValue({ status: 'success', data: { destinations: [{ name: 'Goa', stays: [offer], transport: [], activities: [{ provider: 'Thrillophilia', type: 'ACTIVITY', title: 'Browse experiences', source: 'utility', href: '/go/activity' }] }] } });
  render(<CompleteYourTrip saveId="test" />);
  await screen.findByText('Browse experiences');
  expect(screen.queryByText(/Live prices/i)).toBeNull();
  expect(screen.getAllByText(/Direct merchant links/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByText('Compare booking options'));
  expect(screen.getByText('ITC Hotels')).toBeTruthy();
  expect(screen.getAllByRole('link').every((a) => a.href.includes('/go/'))).toBe(true);
});
test('compact layout retains link-only stay options', async () => {
  api.getTripOffers.mockResolvedValue({ status: 'success', data: { destinations: [{ name: 'Goa', stays: [offer], transport: [] }] } });
  render(<CompleteYourTrip saveId="test" compact />);
  await screen.findByText('Find stays for Goa');
});
test('request failure ends loading and shows an empty state', async () => {
  api.getTripOffers.mockRejectedValue(new Error('network'));
  render(<CompleteYourTrip saveId="test" />);
  await waitFor(() => expect(screen.queryByText(/Finding travel options/)).toBeNull());
});
test('Nykaa is shown only for an actual saved Nykaa URL', async () => {
  api.getTripOffers.mockResolvedValue({ data: { products: [{ ...offer, provider: 'Nykaa', title: 'View your saved item on Nykaa' }] } });
  const view = render(<SavedMerchant save={{ _id: 'one', url: 'https://example.com/' }} />);
  expect(api.getTripOffers).not.toHaveBeenCalled();
  view.rerender(<SavedMerchant save={{ _id: 'two', url: 'https://www.nykaa.com/p/123' }} />);
  await screen.findByText('View your saved item on Nykaa');
});
