import { useState } from 'react';
import { todayStr } from '../../utils/date';
import { EventList } from './EventList';
import { MiniCalendar } from './MiniCalendar';

export function EventsTab() {
  const [selected, setSelected] = useState(todayStr());

  return (
    <section className="flex flex-col gap-3">
      <MiniCalendar selected={selected} onSelect={setSelected} />
      <EventList date={selected} />
    </section>
  );
}
