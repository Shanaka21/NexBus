jest.mock('../config/firebase', () => require('./helpers/firebase'));
const { scoreTrip, rank, explain } = require('../services/recommend.service');

const trip = (over) => ({
  route_number: '138', registration_no: 'NB-4521', eta_min: 9, delay_minutes: 0,
  reservable_seats: 20, available_seats: 12, ...over
});

describe('recommendation scoring', () => {
  test('score = ETA + 0.5 x delay + seat adjustment', () => {
    expect(scoreTrip(trip({ eta_min: 4, delay_minutes: 14 }), false)).toBe(11);
    expect(scoreTrip(trip({ eta_min: 9 }), false)).toBe(9);
  });

  test('seat adjustment of -3 when a seat is needed and available', () => {
    expect(scoreTrip(trip({ eta_min: 9 }), true)).toBe(6);
  });

  test('fully booked reservable trip is excluded when a seat is needed (TC25)', () => {
    expect(scoreTrip(trip({ available_seats: 0 }), true)).toBeNull();
  });

  test('non-reservable bus is not penalised when a seat is needed', () => {
    expect(scoreTrip(trip({ reservable_seats: 0, available_seats: 0, eta_min: 7 }), true)).toBe(7);
  });
});

describe('ranking (TC24)', () => {
  const a = trip({ registration_no: 'A', eta_min: 4, delay_minutes: 14 }); // score 11
  const b = trip({ registration_no: 'B', eta_min: 9, delay_minutes: 0 });  // score 9

  test('on-time bus beats the earlier late bus', () => {
    const { options } = rank([a, b], false);
    expect(options.map(o => o.registration_no)).toEqual(['B', 'A']);
  });

  test('explanation mentions that the earlier bus is late', () => {
    const { explanation } = rank([a, b], false);
    expect(explanation).toBe('Recommended: Bus 138 (B) arrives in 9 min with 12 seats free. The bus arriving in 4 min is 14 min late.');
  });

  test('returns at most three options', () => {
    const many = [1, 2, 3, 4, 5].map(n => trip({ registration_no: `X${n}`, eta_min: n }));
    expect(rank(many, false).options).toHaveLength(3);
  });

  test('no candidates gives no explanation', () => {
    expect(rank([], false)).toEqual({ options: [], explanation: null });
  });

  test('explain names a fully booked earlier bus', () => {
    const full = trip({ eta_min: 3, available_seats: 0 });
    expect(explain(trip({ eta_min: 8 }), [full])).toContain('fully booked');
  });
});
