import AsyncStorage from '@react-native-async-storage/async-storage';
import { clampWeeklyGoal, parseStoredGoal } from './weekly-goal';

export function getWeeklyGoalStorageKey(userId: string) {
  return `fairwayiq:weekly-goal:${userId}`;
}

export async function loadStoredWeeklyGoal(userId: string) {
  try {
    return parseStoredGoal(await AsyncStorage.getItem(getWeeklyGoalStorageKey(userId)));
  } catch {
    return null;
  }
}

export async function saveStoredWeeklyGoal(userId: string, goal: number) {
  try {
    await AsyncStorage.setItem(getWeeklyGoalStorageKey(userId), String(clampWeeklyGoal(goal)));
    return true;
  } catch {
    return false;
  }
}

export async function clearStoredWeeklyGoal(userId: string) {
  try {
    await AsyncStorage.removeItem(getWeeklyGoalStorageKey(userId));
    return true;
  } catch {
    return false;
  }
}
