import type { TransitResult } from "../types";

function parseTimeToDate(timeStr: string | undefined): Date {
  const d = new Date();
  if (!timeStr) return d;
  
  // Try to parse HH:mm or HH:mm:ss
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    d.setHours(parseInt(match[1], 10));
    d.setMinutes(parseInt(match[2], 10));
    d.setSeconds(0);
  }
  return d;
}

function formatDateToICS(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function generateICS(trip: TransitResult) {
  const dtStamp = formatDateToICS(new Date());
  
  const startDate = parseTimeToDate(trip.departureTime);
  let endDate = parseTimeToDate(trip.arrivalTime);
  
  // If end date is before start date, it might be the next day
  if (endDate < startDate) {
    endDate.setDate(endDate.getDate() + 1);
  }

  // Handle case where arrival time is not available
  if (!trip.arrivalTime) {
    // Add 1 hour default
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  }

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Transit App//EN',
    'BEGIN:VEVENT',
    `UID:${trip.id}-${Date.now()}@transitapp`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${formatDateToICS(startDate)}`,
    `DTEND:${formatDateToICS(endDate)}`,
    `SUMMARY:Transit: ${trip.origin} to ${trip.destination}`,
    `DESCRIPTION:Transit from ${trip.origin} to ${trip.destination} via ${trip.service || "Transit"}`,
    `LOCATION:${trip.origin}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `trip-${trip.origin}-to-${trip.destination}.ics`.replace(/\s+/g, '-').toLowerCase();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
