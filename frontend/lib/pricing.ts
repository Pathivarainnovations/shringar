export function formatNpr(v: number): string {
  return "NPR " + v.toLocaleString("en-US");
}

export function formatHour(h: number): string {
  const H = Math.floor(h);
  const m = h % 1 ? "30" : "00";
  const ampm = H % 24 >= 12 ? "PM" : "AM";
  return `${H % 12 || 12}:${m} ${ampm}`;
}
