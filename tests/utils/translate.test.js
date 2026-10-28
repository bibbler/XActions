// Copyright (c) 2024-2026 nich (@nichxbt). Licensed under the Apache License, Version 2.0.
import { describe, it, expect } from 'vitest';
import {
  translateText,
  translateTweets,
  hasLinguisticContent,
  hasNonLatinScript,
  isSameContent,
  shouldAttemptTranslation,
} from '../../src/utils/translate.js';

describe('hasLinguisticContent', () => {
  it('detects letters in standard text', () => {
    expect(hasLinguisticContent('Hello world')).toBe(true);
    expect(hasLinguisticContent('Queen Lalisa')).toBe(true);
    expect(hasLinguisticContent('สุดยอด')).toBe(true);
  });

  it('returns false for pure emojis, symbols, links, and hashtags', () => {
    expect(hasLinguisticContent('❤️❤️')).toBe(false);
    expect(hasLinguisticContent('👍👍👍🔥🔥😍')).toBe(false);
    expect(hasLinguisticContent('🙀🤟🥰')).toBe(false);
    expect(hasLinguisticContent('https://t.co/Fo5hu97Wxa')).toBe(false);
    expect(hasLinguisticContent('#LISA #PressPlay')).toBe(false);
    expect(hasLinguisticContent('🤲 https://t.co/TGeuZGCTHx')).toBe(false);
  });
});

describe('hasNonLatinScript', () => {
  it('detects non-Latin scripts such as Thai, CJK, Hangul, Arabic', () => {
    expect(hasNonLatinScript('สุดยอดไปเลยเพ่')).toBe(true);
    expect(hasNonLatinScript('ลิซ่า ลูกรัก WMA')).toBe(true);
    expect(hasNonLatinScript('こんにちは')).toBe(true);
    expect(hasNonLatinScript('안녕하세요')).toBe(true);
  });

  it('returns false for English and Latin characters with emojis', () => {
    expect(hasNonLatinScript('Hello world! 🔥')).toBe(false);
    expect(hasNonLatinScript('Lisa banger 🔥')).toBe(false);
    expect(hasNonLatinScript('Queen Lalisa')).toBe(false);
  });
});

describe('isSameContent', () => {
  it('identifies identical content regardless of case, punctuation, or trailing urls', () => {
    expect(isSameContent('Queen Lalisa', 'Queen Lalisa')).toBe(true);
    expect(isSameContent('Lisa banger 🔥', 'Lisa banger 🔥')).toBe(true);
    expect(isSameContent('Lisa 💗 https://t.co/Fo5hu97Wxa', 'Lisa 💗')).toBe(true);
    expect(isSameContent('Hello!', 'hello')).toBe(true);
  });

  it('identifies genuinely translated content as different', () => {
    expect(isSameContent('สุดยอดไปเลยเพ่', 'Awesome bro')).toBe(false);
    expect(isSameContent('ชอบมาก', 'I like it so much')).toBe(false);
  });
});

describe('shouldAttemptTranslation', () => {
  it('skips tweets in target language', () => {
    expect(shouldAttemptTranslation('Great album!', 'en', 'en')).toBe(false);
  });

  it('skips tweets without linguistic content (emojis, links, hashtags)', () => {
    expect(shouldAttemptTranslation('❤️❤️', 'qme', 'en')).toBe(false);
    expect(shouldAttemptTranslation('👍👍👍🔥🔥😍', 'und', 'en')).toBe(false);
    expect(shouldAttemptTranslation('https://t.co/m5vHe4vZ2s', 'und', 'en')).toBe(false);
  });

  it('skips Twitter pseudo-language codes when non-Latin script is absent', () => {
    expect(shouldAttemptTranslation('OMG! #LISAxPressPlay', 'und', 'en')).toBe(false);
    expect(shouldAttemptTranslation('https://t.co/Fo5hu97Wxa', 'qme', 'en')).toBe(false);
  });

  it('allows true foreign language tweets', () => {
    expect(shouldAttemptTranslation('สุดยอดไปเลยเพ่', 'th', 'en')).toBe(true);
    expect(shouldAttemptTranslation('ลิซ่า ลูกรัก WMA', 'th', 'en')).toBe(true);
  });
});

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

  it('skips tweets with only urls, emojis, or hashtags', async () => {
    const tweets = [
      { id: '1', lang: 'th', text: '@someone https://t.co/abc123' },
      { id: '2', lang: 'qme', text: '👍👍👍🔥🔥😍' },
      { id: '3', lang: 'und', text: 'OMG! #LISAxPressPlay' },
    ];
    await translateTweets(tweets, { targetLang: 'en' });
    expect(tweets[0].translatedText).toBe('');
    expect(tweets[1].translatedText).toBe('');
    expect(tweets[2].translatedText).toBe('');
  });
});
