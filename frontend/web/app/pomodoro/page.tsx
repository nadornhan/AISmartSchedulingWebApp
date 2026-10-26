import type { Metadata } from 'next';
import { StandalonePomodoro } from '@/components/focus/standalone-pomodoro';

export const metadata: Metadata = {
  title: 'Pomodoro Timer | Chrono',
  description: 'A simple Pomodoro timer for focused work and restorative breaks.',
};

export default function PomodoroPage() {
  return <StandalonePomodoro />;
}
