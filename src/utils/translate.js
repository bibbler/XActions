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
 * Non-linguistic pseudo-BCP 47 language codes used by Twitter.
 * qme = media/emoji only, qam = mentions only, qht = hashtags only, zxx = no linguistic content.
 */
const NON_LINGUISTIC_LANGS = new Set(['qme', 'qam', 'qht', 'zxx']);

/**
 * Check if a string contains actual linguistic letters after stripping
 * URLs, @mentions, #hashtags, and Unicode emojis.
 *
 * @param {string} str
 * @returns {boolean}
 */
export function hasLinguisticContent(str) {
  if (!str) return false;
  const stripped = str
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@\w+/g, '')
    .replace(/#\w+/g, '')
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Presentation}/gu, '')
    .replace(/[^\p{L}]/gu, '');
  return stripped.length > 0;
}

/**
 * Check if text contains non-Latin scripts (e.g. Thai, CJK, Hangul, Arabic, Cyrillic, Devanagari).
 *
 * @param {string} str
 * @returns {boolean}
 */
export function hasNonLatinScript(str) {
  if (!str) return false;
  const stripped = str.replace(/https?:\/\/\S+/g, '').replace(/@\w+/g, '');
  return /[^\u0000-\u024F\u1E00-\u1EFF\s\p{P}\p{S}\p{N}]/u.test(stripped);
}

/**
 * Compare original and translated text to detect if any translation actually occurred.
 * Strips URLs, mentions, punctuation, symbols, and spaces before case-insensitive comparison.
 *
 * @param {string} original
 * @param {string} translated
 * @returns {boolean}
 */
export function isSameContent(original, translated) {
  const normalize = (s) =>
    (s || '')
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/@\w+/g, '')
      .replace(/[\p{P}\p{S}\s]+/gu, '')
      .trim();
  return normalize(original) === normalize(translated);
}

/**
 * Determine whether a tweet is a candidate for translation.
 * Filters out:
 * - Tweets already tagged in the target language (e.g. 'en')
 * - Pure emoji / link / mention tweets (like '❤️❤️', '👍👍👍', 'https://t.co/...')
 * - Twitter pseudo-language tags ('qme', 'qam', 'qht', 'zxx') unless non-Latin script is present
 * - Undetermined text ('und') unless non-Latin script is present
 *
 * @param {string} text
 * @param {string} lang
 * @param {string} [targetLang='en']
 * @returns {boolean}
 */
export function shouldAttemptTranslation(text, lang, targetLang = 'en') {
  if (!text || !text.trim()) return false;
  const normalizedLang = (lang || '').toLowerCase();
  const target = targetLang.toLowerCase();

  // Already in target language
  if (normalizedLang === target) return false;

  const hasLetters = hasLinguisticContent(text);
  if (!hasLetters) return false;

  const hasNonLatin = hasNonLatinScript(text);

  // If Twitter classified as non-linguistic (qme/qam/qht/zxx) and no non-Latin script exists
  if (NON_LINGUISTIC_LANGS.has(normalizedLang) && !hasNonLatin) {
    return false;
  }

  // If undetermined and only Latin characters/numbers (e.g. "OMG! #LISAxPressPlay")
  if (normalizedLang === 'und' && !hasNonLatin) {
    return false;
  }

  return true;
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
    const shouldTranslate = shouldAttemptTranslation(t.text, t.lang, target);

    if (!shouldTranslate) {
      t.translatedText = '';
      continue;
    }

    try {
      const res = await translateText(t.text, target);
      // Only retain translation if it actually differs from original text
      if (res && !isSameContent(t.text, res)) {
        t.translatedText = res;
      } else {
        t.translatedText = '';
      }
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
