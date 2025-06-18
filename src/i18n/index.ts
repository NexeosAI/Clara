// src/i18n/index.ts

interface Translations {
  [key: string]: string | Translations;
}

let translations: Translations = {};
let fallbackTranslation: string = "Missing translation for {key}";

// Function to load translations from the JSON file
// In a real app, you might fetch this or load it based on a selected language
async function loadTranslations() {
  try {
    // In a Vite/React app, public assets are served from the root.
    // The path to the JSON file in the 'public' directory is relative to the domain root.
    const response = await fetch('/locales/white-label-strings.json');
    if (!response.ok) {
      console.error('Failed to load translations:', response.statusText);
      // Load a minimal fallback if the main file fails
      translations = {
        fallback: {
            translationMissing: "Error loading translations. Key: {key}"
        }
      };
      fallbackTranslation = translations.fallback.translationMissing as string;
      return;
    }
    const data = await response.json();
    translations = data;
    if (typeof translations.fallback?.translationMissing === 'string') {
        fallbackTranslation = translations.fallback.translationMissing;
    }
    console.log('Translations loaded successfully.');
  } catch (error) {
    console.error('Error loading or parsing translations:', error);
    translations = {
        fallback: {
            translationMissing: "Critical error loading translations. Key: {key}"
        }
    };
    fallbackTranslation = translations.fallback.translationMissing as string;
  }
}

// Call loadTranslations when this module is initialized.
// This is a simple approach; more sophisticated apps might initialize i18n differently (e.g., in main.tsx).
loadTranslations();

// Function to get a nested value from the translations object using a dot-separated key
function getNestedValue(obj: Translations, key: string): string | undefined {
  const keys = key.split('.');
  let current: string | Translations | undefined = obj;
  for (const k of keys) {
    if (typeof current !== 'object' || current === null || !current.hasOwnProperty(k)) {
      return undefined;
    }
    current = current[k];
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Core translation function.
 * Retrieves a string by its key (e.g., "buttons.submit" or "messages.welcome").
 * Performs basic interpolation for placeholders like {variableName}.
 * Handles fallback for missing keys.
 *
 * @param key The key for the translation string.
 * @param variables Optional object with values for interpolation.
 * @returns The translated and interpolated string, or a fallback string.
 */
export function t(key: string, variables?: Record<string, string | number>): string {
  const stringTemplate = getNestedValue(translations, key);

  if (stringTemplate === undefined) {
    // console.warn(`Translation missing for key: ${key}`);
    return fallbackTranslation.replace('{key}', key);
  }

  let result = stringTemplate;
  if (variables) {
    for (const varName in variables) {
      if (variables.hasOwnProperty(varName)) {
        const regex = new RegExp(`{${varName}}`, 'g');
        result = result.replace(regex, String(variables[varName]));
      }
    }
  }

  return result;
}

// Example of a function that could be used to change language (and reload translations)
// For now, it just reloads the current (default) translations.
export async function changeLanguage(lang: string) {
  // In a real app, you'd fetch `/locales/${lang}.json`
  console.log(`Language change requested to: ${lang}. Reloading default strings for now.`);
  await loadTranslations();
  // You would typically also trigger a re-render of the app if using a context.
}

// Optional: A simple pluralization helper (very basic example)
// For robust pluralization, a library like i18next with CLDR plural rules is recommended.
export function p(key: string, count: number, variables?: Record<string, string | number>): string {
  // This naive example assumes keys like "item_one", "item_other" or "item_zero"
  // It doesn't handle complex language-specific plural rules.
  let pluralKey = `${key}_${count === 1 ? 'one' : 'other'}`;
  if (count === 0 && getNestedValue(translations, `${key}_zero`)) {
    pluralKey = `${key}_zero`;
  }

  const fullVariables = { ...variables, count };

  if (!getNestedValue(translations, pluralKey)) {
    // Fallback to the base key if the specific plural form doesn't exist
    // This allows defining just "items" and using count in interpolation
    const baseTranslation = getNestedValue(translations, key);
    if (baseTranslation) {
        return t(key, fullVariables);
    }
    // If neither specific plural nor base key exists, use standard fallback
    // console.warn(`Plural translation missing for key: ${key} and count: ${count}`);
    return fallbackTranslation.replace('{key}', pluralKey);
  }

  return t(pluralKey, fullVariables);
}

// To make translations reactive in a React app, you might want to integrate this with a Context
// or a state management solution that can trigger re-renders when translations are loaded/changed.
// For now, components will get the translations available at the time they render.
// If loadTranslations completes after initial render, components won't automatically update
// unless they are re-rendered for another reason, or t() is called again.
