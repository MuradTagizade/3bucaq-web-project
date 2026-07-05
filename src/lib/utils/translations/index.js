/**
 * LEVEL UP — Translation dictionaries.
 * Supported languages: English (base), Russian, Turkish, German, French.
 * `en` is the canonical source; missing keys in other languages fall back to English.
 */

import en from './en';
import ru from './ru';
import tr from './tr';
import de from './de';
import fr from './fr';

export const translations = { en, ru, tr, de, fr };

export default translations;
