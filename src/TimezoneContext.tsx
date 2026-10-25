import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useAuth } from './AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { GlobalSettings } from './types';
import { fromZonedTime, toZonedTime, format as tzFormat } from 'date-fns-tz';

interface TimezoneContextType {
  userTimezone: string;
  appTimezone: string;
  convertToUserTime: (
    dateStr: string,
    timeStr: string
  ) => {
    date: string;
    time: string;
    isNextDay: boolean;
    isPrevDay: boolean;
  };
  convertToAppTime: (
    dateStr: string,
    timeStr: string
  ) => { date: string; time: string };
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(
  undefined
);

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [appTimezone, setAppTimezone] = useState<string>(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );

  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      doc(db, 'settings', 'global'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as GlobalSettings;
          if (data.defaultTimezone) {
            setAppTimezone(data.defaultTimezone);
          }
        }
      },
      () => {
        // Fallback to local timezone if global settings doc does not exist yet
      }
    );
    return () => unsub();
  }, [user]);

  const userTimezone =
    profile?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'UTC';

  // Converts a 'YYYY-MM-DD' and 'HH:mm' from App Timezone TO User Timezone
  const convertToUserTime = useCallback(
    (dateStr: string, timeStr: string) => {
      if (!dateStr || !timeStr) {
        return {
          date: dateStr || '',
          time: timeStr || '',
          isNextDay: false,
          isPrevDay: false,
        };
      }

      try {
        const cleanTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
        const dateTimeString = `${dateStr}T${cleanTime}`;
        const utcDate = fromZonedTime(dateTimeString, appTimezone);
        const userDate = toZonedTime(utcDate, userTimezone);

        const newDateStr = tzFormat(userDate, 'yyyy-MM-dd', {
          timeZone: userTimezone,
        });
        const newTimeStr = tzFormat(userDate, 'HH:mm', {
          timeZone: userTimezone,
        });

        return {
          date: newDateStr,
          time: newTimeStr,
          isNextDay: newDateStr > dateStr,
          isPrevDay: newDateStr < dateStr,
        };
      } catch {
        return {
          date: dateStr,
          time: timeStr,
          isNextDay: false,
          isPrevDay: false,
        };
      }
    },
    [appTimezone, userTimezone]
  );

  // Converts a 'YYYY-MM-DD' and 'HH:mm' from User Timezone TO App Timezone
  const convertToAppTime = useCallback(
    (dateStr: string, timeStr: string) => {
      if (!dateStr || !timeStr) {
        return { date: dateStr || '', time: timeStr || '' };
      }
      try {
        const cleanTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
        const dateTimeString = `${dateStr}T${cleanTime}`;
        const utcDate = fromZonedTime(dateTimeString, userTimezone);
        const appDate = toZonedTime(utcDate, appTimezone);
        return {
          date: tzFormat(appDate, 'yyyy-MM-dd', { timeZone: appTimezone }),
          time: tzFormat(appDate, 'HH:mm', { timeZone: appTimezone }),
        };
      } catch {
        return { date: dateStr, time: timeStr };
      }
    },
    [appTimezone, userTimezone]
  );

  const contextValue = useMemo(
    () => ({
      userTimezone,
      appTimezone,
      convertToUserTime,
      convertToAppTime,
    }),
    [userTimezone, appTimezone, convertToUserTime, convertToAppTime]
  );

  return (
    <TimezoneContext.Provider value={contextValue}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}
