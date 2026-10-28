// Copyright (c) 2024-2026 nich (@nichxbt). Licensed under the Apache License, Version 2.0.
/**
 * Translation utility for tweet text.
 * Automatically translates non-English text to English (or target language)
 * using Google Translate endpoint with MyMemory fallback.
 *
 * @author nich (@nichxbt) - https://github.com/nirholas
 * @license Apache-2.0
 */

/**
 * Translate a single text string to the target language.
 *
 * @param {string} text
 * @param {string} [targetLang='en']
 * @returns {Promise<string>} Translated text, or original text if translation fails
 */
export async function translateText(text, targetLang = 'en') {
  if (!text || !text.trim()) return '';
  const clean = text.trim();

  // Primary: Google Translate endpoint (fast, high accuracy, no API key required)
  const gUrl =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
    encodeURIComponent(targetLang) +
    '&dt=t&q=' +
    encodeURIComponent(clean);

  try {
    const res = await fetch(gUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      const translated = (data[0] || []).map((item) => item[0]).join('');
      if (translated && translated.trim()) {
        return translated.trim();
      }
    }
  } catch {}

  // Secondary Fallback: MyMemory Translation API
  try {
    const mUrl =
      'https://api.mymemory.translated.net/get?q=' +
      encodeURIComponent(clean) +
      '&langpair=autodetect|' +
      encodeURIComponent(targetLang);
    const res = await fetch(mUrl, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      if (data.responseData?.translatedText) {
        return data.responseData.translatedText.trim();
      }
    }
  } catch {}

  return '';
}

/**
 * Batch translate non-target language tweets in-place.
 *
 * @param {object[]} tweets
 * @param {object} [options]
 * @param {string} [options.targetLang='en']
 * @param {function} [options.onProgress]
 * @returns {Promise<object[]>}
 */
export async function translateTweets(tweets, { targetLang = 'en', onProgress } = {}) {
  if (!Array.isArray(tweets) || tweets.length === 0) return tweets;

  const target = targetLang.toLowerCase();
  let done = 0;

  for (let i = 0; i < tweets.length; i++) {
    const t = tweets[i];
    const lang = (t.lang || '').toLowerCase();
    const isTargetLang = lang === target;

    // If tweet is already in target language (or no text), keep empty
    if (isTargetLang) {
      t.translatedText = '';
      continue;
    }

    // Strip handles and URLs to see if there is actual foreign text to translate
    const cleanText = (t.text || '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/@\w+/g, '')
      .trim();

    if (!cleanText) {
      t.translatedText = '';
      continue;
    }

    try {
      t.translatedText = await translateText(t.text, target);
    } catch {
      t.translatedText = '';
    }

    done++;
    if (onProgress) {
      onProgress({ index: i, total: tweets.length, done });
    }
  }

  return tweets;
}
