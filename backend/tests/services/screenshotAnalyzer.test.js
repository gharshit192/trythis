const { classifyScreenshot, cleanOcrText } = require('../../src/services/screenshotAnalyzer');

describe('cleanOcrText', () => {
  it('strips --- Image N --- separators', () => {
    expect(cleanOcrText('--- Image 1 ---\nhello')).toBe('hello');
  });
  it('strips status-bar time markers', () => {
    expect(cleanOcrText('9:41 am\nMy receipt')).toContain('My receipt');
    expect(cleanOcrText('9:41 am\nMy receipt')).not.toMatch(/9:41/);
  });
  it('collapses 3+ newlines to a double newline', () => {
    expect(cleanOcrText('a\n\n\n\nb')).toBe('a\n\nb');
  });
});

describe('classifyScreenshot', () => {
  it('classifies a Swiggy receipt as receipt', () => {
    const ocr = `Swiggy order receipt
      Order ID: SW12345
      Item Qty Price
      Subtotal: 450
      GST: 22.50
      Total: 472.50
      Paid by UPI
      Thank you for your purchase`;
    const r = classifyScreenshot(ocr);
    expect(r.type).toBe('receipt');
    expect(r.category).toBe('shopping');
    expect(r.confidence).toBeGreaterThanOrEqual(0.99);
  });

  it('classifies a restaurant menu as menu', () => {
    const ocr = `Starters menu
      Veg options available
      Today's special
      Thali combo ₹250 per plate
      Half portion available`;
    const r = classifyScreenshot(ocr);
    expect(r.type).toBe('menu');
    expect(r.category).toBe('food');
    expect(r.intentType).toBe('reference');
  });

  it('classifies a Myntra product page as product_page', () => {
    const ocr = `Add to cart
      Buy now
      MRP 2999
      Sizes: S M L
      No cost EMI available
      Myntra delivery by tomorrow
      Easy returns`;
    const r = classifyScreenshot(ocr);
    expect(r.type).toBe('product_page');
    expect(r.intentType).toBe('buy');
  });

  it('classifies a tweet as social_post', () => {
    const ocr = `1.2K retweets 5.4K likes
      @elonmusk
      X.com is hiring
      #ai #hiring`;
    const r = classifyScreenshot(ocr);
    expect(r.type).toBe('social_post');
  });

  it('classifies a WhatsApp chat as chat', () => {
    const ocr = `WhatsApp
      delivered 9:41
      online
      Group: 12 members
      Forwarded many times`;
    const r = classifyScreenshot(ocr);
    expect(r.type).toBe('chat');
  });

  it('classifies an IRCTC train booking as travel_booking', () => {
    const ocr = `Train ticket confirmation
      PNR Number: 1234567890
      Departure: 14:30
      Coach S5, berth 32
      IRCTC booking
      Boarding pass`;
    const r = classifyScreenshot(ocr);
    expect(r.type).toBe('travel_booking');
    expect(r.category).toBe('travel');
  });

  it('falls through to unknown when nothing matches', () => {
    const r = classifyScreenshot('random text with no signals at all');
    expect(r.type).toBe('unknown');
    expect(r.confidence).toBe(0);
  });

  it('returns allMatches with top 3 candidates', () => {
    const ocr = `Subtotal 100 GST 18 Total 118 Order ID 123`;
    const r = classifyScreenshot(ocr);
    expect(r.allMatches.length).toBeGreaterThan(0);
    expect(r.allMatches.length).toBeLessThanOrEqual(3);
  });
});
