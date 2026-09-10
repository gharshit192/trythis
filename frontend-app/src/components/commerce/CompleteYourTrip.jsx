import SectionLabel from '../SectionLabel';
import './CompleteYourTrip.css';

export default function CompleteYourTrip() {
  return (
    <section className="trip-options" aria-label="Stay and travel options">
      <SectionLabel>Stay & travel</SectionLabel>
      <p className="trip-options-note">Hotel, bus and flight options are coming soon.</p>
      <ul className="trip-options-list">
        {['Hotels', 'Buses', 'Flights'].map((label) => (
          <li key={label} className="trip-options-row">
            <span className="wt-row-title">{label}</span>
            <span className="trip-options-status">Coming soon</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
