const { looksLikeHallucination } = require('../../src/utils/hallucinationGuard');

describe('looksLikeHallucination', () => {
  it('catches the real-world "I am here with my little friends" x15 case', () => {
    const text = Array(15).fill('"I am here with my little friends"').join(' ');
    expect(looksLikeHallucination(text)).toBe(true);
  });

  it('catches the "I\'m going to eat some of this" x22 case', () => {
    const text = Array(22).fill("I'm going to eat some of this.").join(' ');
    expect(looksLikeHallucination(text)).toBe(true);
  });

  it('keeps a real recipe transcript', () => {
    const text = "I am telling you the truth, if you have tried this sandwich once, then you will get all the sandwiches. It is going to be very tasty after having it with chutney and flavor. For this, take out the capsicum, onion and tomato and mix it well. In the pan, we need to toss it for 2-3 minutes. It should be soft and crunchy.";
    expect(looksLikeHallucination(text)).toBe(false);
  });

  it('does not flag short text (no judgment)', () => {
    expect(looksLikeHallucination('hello world')).toBe(false);
    expect(looksLikeHallucination('a a a a a')).toBe(false);
  });

  it('handles null / empty / non-string safely', () => {
    expect(looksLikeHallucination(null)).toBe(false);
    expect(looksLikeHallucination('')).toBe(false);
    expect(looksLikeHallucination(123)).toBe(false);
  });

  it('allows a refrain repeated < 5 times', () => {
    const text = "Hello world, this is a test. Hello world, this is a test. Hello world, this is a test. Hello world, this is a test. Some other content follows here.";
    expect(looksLikeHallucination(text)).toBe(false);
  });
});
