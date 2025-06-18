// src/hooks/useTheme.tsx
import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark';
export type Brand = 'default' | 'brand-alpha' | string; // Allow any string for future brands

export interface ThemeConfig {
  mode: ThemeMode;
  brand: Brand;
}

// Define a more specific type for theme properties if needed
export interface ThemeProperties {
  [key: string]: string;
}

// Initial theme based on system preference or stored value
const getInitialMode = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const storedMode = localStorage.getItem('themeMode') as ThemeMode;
    if (storedMode) return storedMode;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light'; // Default for non-browser environments
};

const getInitialBrand = (): Brand => {
  if (typeof window !== 'undefined') {
    const storedBrand = localStorage.getItem('themeBrand') as Brand;
    return storedBrand || 'default';
  }
  return 'default'; // Default for non-browser environments
};

export const useTheme = () => {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);
  const [brand, setBrand] = useState<Brand>(getInitialBrand);

  const applyTheme = useCallback((newMode: ThemeMode, newBrand: Brand) => {
    if (typeof document === 'undefined') return; // Guard for SSR or non-browser environments

    const root = document.documentElement; // Or document.body if preferred

    // Remove previous classes
    root.classList.remove('light-mode', 'dark-mode');
    // Consider removing all brand classes if you have a dynamic list
    // For now, explicitly remove known ones or manage through a single brand class
    if (brand !== 'default') { // Assuming 'default' means no specific brand class
        root.classList.remove(brand); // remove current brand class
    }
    if (newBrand !== 'default') {
        root.classList.remove(newBrand); // remove new brand class just in case
    }


    // Add new classes
    if (newMode === 'dark') {
      root.classList.add('dark-mode');
    } else {
      root.classList.add('light-mode'); // Optional: if you have specific light-mode styles beyond :root defaults
    }

    if (newBrand !== 'default') {
      root.classList.add(newBrand);
    }

    // Persist theme choice
    localStorage.setItem('themeMode', newMode);
    localStorage.setItem('themeBrand', newBrand);
  }, [brand]); // Added brand to dependency array

  useEffect(() => {
    applyTheme(mode, brand);
  }, [mode, brand, applyTheme]);

  const toggleMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const changeBrand = (newBrand: Brand) => {
    setBrand(newBrand);
  };

  // Function to get current theme properties (primarily for JS access if needed)
  // CSS custom properties are generally preferred for styling
  const getThemeProperties = useCallback((): ThemeProperties => {
    if (typeof getComputedStyle === 'undefined') return {}; // Guard for non-browser environments
    const style = getComputedStyle(document.documentElement);
    const properties: ThemeProperties = {};
    // Example: Extract specific properties if needed in JS
    // properties['--primary-color'] = style.getPropertyValue('--primary-color').trim();
    // properties['--background-color'] = style.getPropertyValue('--background-color').trim();
    // For now, returning an empty object as direct JS access to many properties might be rare
    return properties;
  }, []);


  // Listen for external configuration changes (e.g., from a global config object or event)
  // This is a placeholder for actual implementation based on how brand config is managed.
  useEffect(() => {
    const handleConfigUpdate = (event: any) => {
      // Assuming the event detail contains { brand: Brand, mode?: ThemeMode }
      const { brand: newBrand, mode: newMode } = event.detail;
      if (newBrand) {
        setBrand(newBrand);
      }
      if (newMode) {
        setMode(newMode);
      }
    };

    // Example: window.addEventListener('brand-config-updated', handleConfigUpdate);
    // return () => window.removeEventListener('brand-config-updated', handleConfigUpdate);
  }, []);

  return {
    mode,
    brand,
    toggleMode,
    changeBrand,
    setMode, // Expose setMode directly for more control if needed
    setBrand, // Expose setBrand directly
    getThemeProperties,
  };
};

// Example of how an external event might be dispatched (for testing or from a config loader)
// setTimeout(() => {
//   window.dispatchEvent(new CustomEvent('brand-config-updated', {
//     detail: { brand: 'brand-alpha', mode: 'dark' }
//   }));
// }, 5000);
