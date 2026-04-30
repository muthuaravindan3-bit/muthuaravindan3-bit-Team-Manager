import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { GlobalSettings } from './types';
import { format, parse } from 'date-fns';
import { fromZonedTime, toZonedTime, format as tzFormat } from 'date-fns-tz';

interface TimezoneContextType {
  userTimezone: string;
  appTimezone: string;
  convertToUserTime: (dateStr: string, timeStr: string) => { date: string, time: string, isNextDay: boolean, isPrevDay: boolean };
  convertToAppTime: (dateStr: string, timeStr: string) => { date: string, time: string };
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [appTimezone, setAppTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as GlobalSettings;
        if (data.defaultTimezone) {
          setAppTimezone(data.defaultTimezone);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });
    return () => unsub();
  }, []);

  const userTimezone = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Converts a 'YYYY-MM-DD' and 'HH:mm' from App Timezone TO User Timezone
  const convertToUserTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return { date: dateStr, time: timeStr, isNextDay: false, isPrevDay: false };
    
    try {
      const dateTimeString = `${dateStr}T${timeStr}:00`;
      // Interpret the raw string in the source App Timezone
      const utcDate = fromZonedTime(dateTimeString, appTimezone);
      
      // Convert to the Target User Timezone
      const userDate = toZonedTime(utcDate, userTimezone);
      
      const newDateStr = tzFormat(userDate, 'yyyy-MM-dd', { timeZone: userTimezone });
      const newTimeStr = tzFormat(userDate, 'HH:mm', { timeZone: userTimezone });
      
      return {
        date: newDateStr,
        time: newTimeStr,
        isNextDay: newDateStr > dateStr,
        isPrevDay: newDateStr < dateStr
      };
    } catch (e) {
      return { date: dateStr, time: timeStr, isNextDay: false, isPrevDay: false };
    }
  };

  // Converts a 'YYYY-MM-DD' and 'HH:mm' from User Timezone TO App Timezone
  const convertToAppTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return { date: dateStr, time: timeStr };
    try {
      const dateTimeString = `${dateStr}T${timeStr}:00`;
      const utcDate = fromZonedTime(dateTimeString, userTimezone);
      const appDate = toZonedTime(utcDate, appTimezone);
      return {
        date: tzFormat(appDate, 'yyyy-MM-dd', { timeZone: appTimezone }),
        time: tzFormat(appDate, 'HH:mm', { timeZone: appTimezone })
      };
    } catch (e) {
      return { date: dateStr, time: timeStr };
    }
  };

  return (
    <TimezoneContext.Provider value={{ userTimezone, appTimezone, convertToUserTime, convertToAppTime }}>
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
