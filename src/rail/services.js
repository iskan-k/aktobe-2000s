/*
 * Passenger services through Aktobe, by direction of travel. The names
 * are plausible for the line in 2007, for flavour; the numbers are not
 * taken from a real timetable. The route boards on the coaches read the
 * same list (decals.js), so a service's index is also its board row.
 */
export const SERVICES = {
  1: ['№7 Москва – Алматы', '№95 Оренбург – Мангышлак', '№39 Актобе – Кызылорда', '№357 Самара – Алматы'],
  [-1]: ['№8 Алматы – Москва', '№96 Мангышлак – Оренбург', '№40 Кызылорда – Орск', '№358 Алматы – Самара'],
};

/** Every service once, in a fixed order. */
export const SERVICE_LIST = [...SERVICES[1], ...SERVICES[-1]];
