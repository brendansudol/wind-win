import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { defaultUnitsForLocale, type Units } from '@/lib/format';

const STORAGE_KEY = 'units';

const UnitsContext = createContext<{ units: Units; setUnits: (u: Units) => void }>({
  units: 'kmh',
  setUnits: () => {},
});

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [units, setUnitsState] = useState<Units>(defaultUnitsForLocale());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'kmh' || stored === 'mph') setUnitsState(stored);
      })
      .catch(() => {});
  }, []);

  const setUnits = useCallback((u: Units) => {
    setUnitsState(u);
    AsyncStorage.setItem(STORAGE_KEY, u).catch(() => {});
  }, []);

  return <UnitsContext.Provider value={{ units, setUnits }}>{children}</UnitsContext.Provider>;
}

export const useUnits = () => useContext(UnitsContext);
