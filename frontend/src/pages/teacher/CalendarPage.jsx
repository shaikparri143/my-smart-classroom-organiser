import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../services/api";
import { getAccessToken } from "../../services/auth";

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const eventTypeOptions = [
  "assignment",
  "exam",
  "quiz",
  "meeting",
  "presentation",
  "reminder",
  "general",
];

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function getWeekdayLabel(weekday) {
  return weekdayNames[Number(weekday) % 7] ?? "Day";
}

function formatTime(timeValue) {
  if (!timeValue) {
    return "No time";
  }
  return timeValue;
}

export default function CalendarPage({ role = "teacher" }) {
  const [preferences, setPreferences] = useState(null);
  const [entries, setEntries] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthDate, setMonthDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupMode, setSetupMode] = useState(null);
  const [setupForm, setSetupForm] = useState({
    timetable_mode: "weekly",
    day_order_count: 3,
    first_teaching_date: formatInputDate(new Date()),
    first_day_order: 1,
    teaching_weekdays: [1, 2, 3, 4, 5],
    holiday_policy: "skip",
  });
  const [entryForm, setEntryForm] = useState({
    title: "",
    weekday: "1",
    day_order: "",
    start_time: "09:00",
    end_time: "10:00",
    location: "",
    notes: "",
    course_id: "",
  });
  const [eventForm, setEventForm] = useState({
    title: "",
    event_type: "assignment",
    date: formatInputDate(new Date()),
    start_time: "09:00",
    end_time: "10:00",
    description: "",
    course_id: "",
  });

  const refreshCalendar = async () => {
    setLoading(true);
    setError("");
    try {
      const [prefsResponse, timetableResponse, eventResponse] = await Promise.all([
        apiRequest("/api/calendar/preferences", { token: getAccessToken() }),
        apiRequest("/api/calendar/timetable", { token: getAccessToken() }),
        apiRequest("/api/calendar/events", { token: getAccessToken() }),
      ]);
      setPreferences(prefsResponse);
      setEntries(timetableResponse ?? []);
      setEvents(eventResponse ?? []);
      if (prefsResponse?.configured) {
        setSetupMode(null);
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to load the calendar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCalendar();
  }, [role]);

  const getDayOrderForDate = (targetDate) => {
    if (!preferences || preferences.timetable_mode !== "day_order") {
      return null;
    }
    if (!preferences.first_teaching_date) {
      return null;
    }
    const teachingWeekdays = new Set((preferences.teaching_weekdays ?? [1, 2, 3, 4, 5]).map(Number));
    const cycleLength = Number(preferences.day_order_count || 1);
    const firstDate = new Date(`${preferences.first_teaching_date}T00:00:00`);
    const eligibleDays = [];
    const limit = addDays(firstDate, 3650);
    for (let cursor = new Date(firstDate); cursor <= limit; cursor = addDays(cursor, 1)) {
      if (teachingWeekdays.has(cursor.getDay())) {
        eligibleDays.push(new Date(cursor));
      }
    }
    for (let index = 0; index < eligibleDays.length; index += 1) {
      if (dateKey(eligibleDays[index]) === dateKey(targetDate)) {
        const firstOrder = Number(preferences.first_day_order || 1);
        return ((index + (firstOrder - 1)) % cycleLength) + 1;
      }
    }
    return null;
  };

  const dayDetails = useMemo(() => {
    const byDay = new Map();
    const dayKeys = new Set();
    for (const entry of entries) {
      const matches = (targetDate) => {
        if (entry.weekday !== null && entry.weekday !== undefined) {
          return Number(targetDate.getDay()) === Number(entry.weekday);
        }
        if (entry.day_order !== null && entry.day_order !== undefined) {
          return getDayOrderForDate(targetDate) === Number(entry.day_order);
        }
        return false;
      };
      for (let cursor = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1); cursor.getMonth() === monthDate.getMonth() || cursor < addDays(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1), 7); cursor = addDays(cursor, 1)) {
        if (matches(cursor)) {
          const key = dateKey(cursor);
          const list = byDay.get(key) ?? [];
          list.push(entry);
          byDay.set(key, list);
          dayKeys.add(key);
        }
      }
    }

    for (const event of events) {
      const start = new Date(event.start_at);
      const key = dateKey(start);
      const list = byDay.get(key) ?? [];
      list.push({ ...event, isEvent: true });
      byDay.set(key, list);
      dayKeys.add(key);
    }
    return { byDay, dayKeys };
  }, [entries, events, monthDate, preferences]);

  const monthCells = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const current = addDays(new Date(year, month, 1), index - startOffset);
      cells.push({
        key: `${dateKey(current)}-${index}`,
        date: current,
        isCurrentMonth: current.getMonth() === month,
        isToday: dateKey(current) === dateKey(new Date()),
      });
    }
    return cells;
  }, [monthDate]);

  const selectedDateEntries = useMemo(() => {
    const selectedKey = dateKey(selectedDate);
    const matches = (entry) => {
      if (entry.isEvent) {
        return dateKey(new Date(entry.start_at)) === selectedKey;
      }
      if (entry.weekday !== null && entry.weekday !== undefined) {
        return Number(selectedDate.getDay()) === Number(entry.weekday);
      }
      if (entry.day_order !== null && entry.day_order !== undefined) {
        return getDayOrderForDate(selectedDate) === Number(entry.day_order);
      }
      return false;
    };
    return [...(dayDetails.byDay.get(selectedKey) ?? [])].filter(matches).sort((a, b) => {
      if (a.isEvent && !b.isEvent) return 1;
      if (!a.isEvent && b.isEvent) return -1;
      const aTime = a.start_time ?? a.start_at ?? "23:59";
      const bTime = b.start_time ?? b.start_at ?? "23:59";
      return aTime.localeCompare(bTime);
    });
  }, [selectedDate, dayDetails, preferences]);

  const handleSavePreferences = async () => {
    try {
      const payload = {
        timetable_mode: setupForm.timetable_mode,
        day_order_count: Number(setupForm.day_order_count || 1),
        teaching_weekdays: Array.from(new Set(setupForm.teaching_weekdays.map(Number))),
        first_teaching_date: setupForm.timetable_mode === "day_order" ? setupForm.first_teaching_date : null,
        first_day_order: Number(setupForm.first_day_order || 1),
        holiday_policy: setupForm.holiday_policy,
      };
      const response = await apiRequest("/api/calendar/preferences", {
        method: "POST",
        token: getAccessToken(),
        body: payload,
      });
      setPreferences(response);
      setSetupMode(null);
      await refreshCalendar();
    } catch (requestError) {
      setError(requestError.message || "Unable to save timetable settings.");
    }
  };

  const handleCreateEntry = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        title: entryForm.title,
        weekday: entryForm.weekday ? Number(entryForm.weekday) : null,
        day_order: entryForm.day_order ? Number(entryForm.day_order) : null,
        start_time: entryForm.start_time,
        end_time: entryForm.end_time,
        location: entryForm.location || null,
        notes: entryForm.notes || null,
        course_id: entryForm.course_id ? Number(entryForm.course_id) : null,
      };
      await apiRequest("/api/calendar/timetable", {
        method: "POST",
        token: getAccessToken(),
        body: payload,
      });
      setEntryForm({
        title: "",
        weekday: "1",
        day_order: "",
        start_time: "09:00",
        end_time: "10:00",
        location: "",
        notes: "",
        course_id: "",
      });
      await refreshCalendar();
    } catch (requestError) {
      setError(requestError.message || "Unable to add the timetable entry.");
    }
  };

  const handleCreateEvent = async (event) => {
    event.preventDefault();
    try {
      const startDateTime = new Date(`${eventForm.date}T${eventForm.start_time || "09:00"}:00`);
      const endDateTime = new Date(`${eventForm.date}T${eventForm.end_time || "10:00"}:00`);
      await apiRequest("/api/calendar/events", {
        method: "POST",
        token: getAccessToken(),
        body: {
          title: eventForm.title,
          event_type: eventForm.event_type,
          description: eventForm.description || null,
          start_at: startDateTime.toISOString(),
          end_at: endDateTime.toISOString(),
          course_id: eventForm.course_id ? Number(eventForm.course_id) : null,
        },
      });
      setEventForm({
        title: "",
        event_type: "assignment",
        date: formatInputDate(new Date()),
        start_time: "09:00",
        end_time: "10:00",
        description: "",
        course_id: "",
      });
      await refreshCalendar();
    } catch (requestError) {
      setError(requestError.message || "Unable to create the event.");
    }
  };

  const handleDeleteEntry = async (entryId) => {
    try {
      await apiRequest(`/api/calendar/timetable/${entryId}`, {
        method: "DELETE",
        token: getAccessToken(),
      });
      await refreshCalendar();
    } catch (requestError) {
      setError(requestError.message || "Unable to remove the timetable entry.");
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await apiRequest(`/api/calendar/events/${eventId}`, {
        method: "DELETE",
        token: getAccessToken(),
      });
      await refreshCalendar();
    } catch (requestError) {
      setError(requestError.message || "Unable to remove the calendar event.");
    }
  };

  if (loading) {
    return <p className="course-empty" role="status">Loading calendar...</p>;
  }

  if (error) {
    return <p className="course-message course-error" role="alert">{error}</p>;
  }

  if (!preferences || !preferences.configured) {
    return (
      <div className="course-management">
        <section className="panel" style={{ padding: 24 }}>
          <div className="panel-heading">
            <div>
              <h2>Which timetable format do you follow?</h2>
              <p>Select a format to begin building your calendar.</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginTop: 18 }}>
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                setSetupMode("weekly");
                setSetupForm((current) => ({ ...current, timetable_mode: "weekly" }));
              }}
              style={{ padding: 18, minHeight: 170, textAlign: "left" }}
            >
              <strong>Option A: Regular Weekly Timetable</strong>
              <p style={{ marginTop: 12, marginBottom: 0 }}>Monday to Friday timetable with reusable recurring periods.</p>
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setSetupMode("day_order");
                setSetupForm((current) => ({ ...current, timetable_mode: "day_order" }));
              }}
              style={{ padding: 18, minHeight: 170, textAlign: "left" }}
            >
              <strong>Option B: Day-Order Timetable</strong>
              <p style={{ marginTop: 12, marginBottom: 0 }}>Configure day-order cycles for institutions with rotating schedules.</p>
            </button>
          </div>

          {setupMode && (
            <div style={{ marginTop: 20, padding: 18, border: "1px solid #eef0f5", borderRadius: 12 }}>
              <div style={{ display: "grid", gap: 14 }}>
                {setupMode === "day_order" && (
                  <>
                    <label>
                      Day orders in the cycle
                      <input type="number" min="1" max="14" value={setupForm.day_order_count} onChange={(event) => setSetupForm({ ...setupForm, day_order_count: Number(event.target.value) })} />
                    </label>
                    <label>
                      First eligible teaching date
                      <input type="date" value={setupForm.first_teaching_date} onChange={(event) => setSetupForm({ ...setupForm, first_teaching_date: event.target.value })} />
                    </label>
                    <label>
                      First day order
                      <input type="number" min="1" max="14" value={setupForm.first_day_order} onChange={(event) => setSetupForm({ ...setupForm, first_day_order: Number(event.target.value) })} />
                    </label>
                    <label>
                      Teaching weekdays
                      <select multiple value={setupForm.teaching_weekdays.map(String)} onChange={(event) => {
                        const selected = [...event.target.selectedOptions].map((option) => Number(option.value));
                        setSetupForm({ ...setupForm, teaching_weekdays: selected });
                      }}>
                        {weekdayNames.map((label, index) => (
                          <option key={label} value={index}>{label}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {setupMode === "weekly" && (
                  <div>
                    <p style={{ margin: 0 }}>Weekly mode uses Monday to Friday by default with a reusable recurring timetable.</p>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" className="button-primary" onClick={handleSavePreferences}>Save timetable</button>
                  <button type="button" className="button-secondary" onClick={() => setSetupMode(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="course-management">
      <section className="panel" style={{ padding: 18 }}>
        <div className="panel-heading">
          <div>
            <h2>{preferences?.timetable_mode === "day_order" ? "Day-order calendar" : "Weekly calendar"}</h2>
            <p>{preferences?.timetable_mode === "day_order" ? "The sequence is calculated from your configured teaching date and day order cycle." : "Recurring weekday schedule and academic items."}</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="button-secondary" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}>Prev</button>
            <strong>{monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
            <button type="button" className="button-secondary" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}>Next</button>
            <button type="button" className="button-secondary" onClick={() => setMonthDate(new Date())}>Today</button>
            <button type="button" className="button-primary" onClick={() => setSetupMode(preferences?.timetable_mode || "weekly")}>Edit Timetable Settings</button>
          </div>
        </div>

        {setupMode && (
          <div style={{ marginTop: 20, padding: 18, border: "1px solid #eef0f5", borderRadius: 12 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <label>
                Timetable format
                <select value={setupMode} onChange={(event) => setSetupMode(event.target.value)}>
                  <option value="weekly">Regular weekly timetable</option>
                  <option value="day_order">Day-order timetable</option>
                </select>
              </label>
              {setupMode === "day_order" && (
                <>
                  <label>
                    Day orders in the cycle
                    <input type="number" min="1" max="14" value={setupForm.day_order_count} onChange={(event) => setSetupForm({ ...setupForm, day_order_count: Number(event.target.value) })} />
                  </label>
                  <label>
                    First eligible teaching date
                    <input type="date" value={setupForm.first_teaching_date || formatInputDate(new Date())} onChange={(event) => setSetupForm({ ...setupForm, first_teaching_date: event.target.value })} />
                  </label>
                  <label>
                    First day order
                    <input type="number" min="1" max="14" value={setupForm.first_day_order} onChange={(event) => setSetupForm({ ...setupForm, first_day_order: Number(event.target.value) })} />
                  </label>
                </>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="button-primary" onClick={handleSavePreferences}>Save changes</button>
                <button type="button" className="button-secondary" onClick={() => setSetupMode(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8, marginTop: 16 }}>
          {weekdayNames.map((day) => (
            <div key={day} style={{ textAlign: "center", fontWeight: 700, color: "#7a8097", fontSize: 12 }}>{day}</div>
          ))}
          {monthCells.map((cell) => {
            const cellKey = dateKey(cell.date);
            const dayEntries = entries.filter((entry) => {
              if (entry.weekday !== null && entry.weekday !== undefined) {
                return Number(cell.date.getDay()) === Number(entry.weekday);
              }
              if (entry.day_order !== null && entry.day_order !== undefined) {
                return getDayOrderForDate(cell.date) === Number(entry.day_order);
              }
              return false;
            });
            const dayEvents = events.filter((event) => dateKey(new Date(event.start_at)) === cellKey);
            return (
              <button
                type="button"
                key={cell.key}
                onClick={() => setSelectedDate(cell.date)}
                style={{
                  minHeight: 100,
                  background: cell.isCurrentMonth ? "#fff" : "#f7f8fc",
                  border: cell.isToday ? "1px solid #7969df" : "1px solid #eef0f5",
                  borderRadius: 10,
                  padding: 8,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: cell.isCurrentMonth ? "#2f3348" : "#a5acc0" }}>{cell.date.getDate()}</div>
                {preferences?.timetable_mode === "day_order" && getDayOrderForDate(cell.date) && (
                  <div style={{ fontSize: 10, color: "#7969df", marginTop: 4 }}>Day {getDayOrderForDate(cell.date)}</div>
                )}
                <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                  {[...dayEntries, ...dayEvents].slice(0, 2).map((item, index) => (
                    <div key={`${item.id ?? index}-${item.title}`} style={{ background: item.isEvent ? "#eaf5ff" : "#efeaff", borderRadius: 6, padding: "4px 6px", fontSize: 9, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.title}
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18, padding: 18 }}>
        <div className="panel-heading">
          <div>
            <h2>{selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2>
            {preferences?.timetable_mode === "day_order" && getDayOrderForDate(selectedDate) && (
              <p>Day order {getDayOrderForDate(selectedDate)}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="button-secondary" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>Previous day</button>
            <button type="button" className="button-secondary" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>Next day</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(260px, 0.7fr)", gap: 18, marginTop: 16 }}>
          <div>
            {selectedDateEntries.length === 0 ? (
              <p className="course-empty">No timetable or events scheduled for this day.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {selectedDateEntries.map((item, index) => (
                  <div key={`${item.id ?? item.title}-${index}`} className="panel" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <strong>{item.title}</strong>
                      <span style={{ fontSize: 11, color: "#6b7280", textTransform: "capitalize" }}>{item.isEvent ? item.event_type : "Schedule"}</span>
                    </div>
                    {!item.isEvent && (
                      <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 13 }}>
                        <span>{item.start_time} – {item.end_time}</span>
                        {item.location && <span>Location: {item.location}</span>}
                        {item.notes && <span>Notes: {item.notes}</span>}
                      </div>
                    )}
                    {item.isEvent && (
                      <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 13 }}>
                        <span>{new Date(item.start_at).toLocaleString()} to {new Date(item.end_at).toLocaleString()}</span>
                        {item.description && <span>{item.description}</span>}
                      </div>
                    )}
                    {!item.isEvent ? (
                      <button type="button" className="button-secondary" style={{ marginTop: 10 }} onClick={() => handleDeleteEntry(item.id)}>Delete entry</button>
                    ) : (
                      <button type="button" className="button-secondary" style={{ marginTop: 10 }} onClick={() => handleDeleteEvent(item.id.replace("event-", ""))}>Delete event</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <form onSubmit={handleCreateEntry} className="panel" style={{ padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>Add timetable entry</h3>
              <div style={{ display: "grid", gap: 10 }}>
                <label>
                  Subject / activity
                  <input value={entryForm.title} onChange={(event) => setEntryForm({ ...entryForm, title: event.target.value })} required />
                </label>
                {preferences?.timetable_mode === "weekly" ? (
                  <label>
                    Weekday
                    <select value={entryForm.weekday} onChange={(event) => setEntryForm({ ...entryForm, weekday: event.target.value })}>
                      {weekdayNames.slice(1).map((label, index) => (
                        <option key={label} value={index + 1}>{label}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    Day order
                    <input type="number" min="1" max="14" value={entryForm.day_order} onChange={(event) => setEntryForm({ ...entryForm, day_order: event.target.value })} />
                  </label>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <label>
                    Start time
                    <input type="time" value={entryForm.start_time} onChange={(event) => setEntryForm({ ...entryForm, start_time: event.target.value })} required />
                  </label>
                  <label>
                    End time
                    <input type="time" value={entryForm.end_time} onChange={(event) => setEntryForm({ ...entryForm, end_time: event.target.value })} required />
                  </label>
                </div>
                <label>
                  Location
                  <input value={entryForm.location} onChange={(event) => setEntryForm({ ...entryForm, location: event.target.value })} />
                </label>
                <label>
                  Notes
                  <textarea value={entryForm.notes} onChange={(event) => setEntryForm({ ...entryForm, notes: event.target.value })} rows={3} />
                </label>
                <button type="submit" className="button-primary">Add entry</button>
              </div>
            </form>

            <form onSubmit={handleCreateEvent} className="panel" style={{ padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>Add event</h3>
              <div style={{ display: "grid", gap: 10 }}>
                <label>
                  Title
                  <input value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} required />
                </label>
                <label>
                  Event type
                  <select value={eventForm.event_type} onChange={(event) => setEventForm({ ...eventForm, event_type: event.target.value })}>
                    {eventTypeOptions.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Date
                  <input type="date" value={eventForm.date} onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })} required />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <label>
                    Start time
                    <input type="time" value={eventForm.start_time} onChange={(event) => setEventForm({ ...eventForm, start_time: event.target.value })} />
                  </label>
                  <label>
                    End time
                    <input type="time" value={eventForm.end_time} onChange={(event) => setEventForm({ ...eventForm, end_time: event.target.value })} />
                  </label>
                </div>
                <label>
                  Description
                  <textarea value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} rows={3} />
                </label>
                <button type="submit" className="button-primary">Create event</button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
