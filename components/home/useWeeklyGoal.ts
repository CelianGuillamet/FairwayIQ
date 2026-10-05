import { useCallback, useEffect, useState } from 'react';
import { clearStoredWeeklyGoal, loadStoredWeeklyGoal, saveStoredWeeklyGoal } from '../../lib/weekly-goal-storage';
import { clampWeeklyGoal, getGoalFromFrequency } from '../../lib/weekly-goal';

export function useWeeklyGoal(userId: string | undefined, playFrequency: string | undefined) {
  const [override, setOverride] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setOverride(null);
    setLoaded(false);

    if (!userId) {
      setLoaded(true);
      return;
    }

    void loadStoredWeeklyGoal(userId).then((stored) => {
      if (!active) return;
      setOverride(stored);
      setLoaded(true);
    });

    return () => {
      active = false;
    };
  }, [userId]);

  const recommended = getGoalFromFrequency(playFrequency);
  const customGoal = override != null && override !== recommended ? override : null;

  const setGoal = useCallback(
    (value: number) => {
      const next = clampWeeklyGoal(value);

      if (next === recommended) {
        setOverride(null);
        if (userId) void clearStoredWeeklyGoal(userId);
        return;
      }

      setOverride(next);
      if (userId) void saveStoredWeeklyGoal(userId, next);
    },
    [recommended, userId],
  );

  const resetGoal = useCallback(() => {
    setOverride(null);
    if (userId) void clearStoredWeeklyGoal(userId);
  }, [userId]);

  return { goal: customGoal ?? recommended, recommended, isCustom: customGoal != null, loaded, setGoal, resetGoal };
}
