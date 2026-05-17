// Working-day arithmetic: skips Saturday (6) and Sunday (0).
// No public-holiday calendar — keep it simple unless we need one.

const addWorkingDays = (date, n) => {
  const d = new Date(date);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
};

module.exports = { addWorkingDays };
