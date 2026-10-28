// Copyright (c) 2024-2026 nich (@nichxbt). Licensed under the Apache License, Version 2.0.
import { describe, it, expect, vi } from 'vitest';
import { translateText, translateTweets } from '../../src/utils/translate.js';

describe('translateText', () => {
  it('returns empty string for empty or blank input', async () => {
    expect(await translateText('')).toBe('');
    expect(await translateText('   ')).toBe('');
    expect(await translateText(null)).toBe('');
  });
});

describe('translateTweets', () => {
  it('skips tweets already in target language', async () => {
    const tweets = [
      { id: '1', lang: 'en', text: 'This is in English' },
      { id: '2', lang: 'EN', text: 'Another English tweet' },
    ];
    await translateTweets(tweets, { targetLang: 'en' });
    expect(tweets[0].translatedText).toBe('');
    expect(tweets[1].translatedText).toBe('');
  });

  it('skips tweets with only urls or handles', async () => {
    const tweets = [
      { id: '1', lang: 'th', text: '@someone https://t.co/abc123' },
    ];
    await translateTweets(tweets, { targetLang: 'en' });
    expect(tweets[0].translatedText).toBe('');
  });
});
