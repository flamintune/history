import { useState, useEffect } from "react";
import { getAvailableDates } from "@/lib/storage-manager";

export function useAvailableDates() {
  const [isLoading, setIsLoading] = useState(true);
  const [dates, setDates] = useState<string[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const availableDates = await getAvailableDates();
      setDates(availableDates);
    } catch (error) {
      console.error("Error loading available dates:", error);
      setDates([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return {
    isLoading,
    dates,
    refresh: loadData,
  };
}