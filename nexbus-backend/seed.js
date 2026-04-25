require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nexbus-7f898-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

const ROUTES = [
  { id: 'r048', route_number: '48',  route_name: 'Fort – Kandy Express',        start_point: 'Fort',       end_point: 'Kandy',          via: 'Peradeniya' },
  { id: 'r017', route_number: '17',  route_name: 'Pettah – Kottawa',            start_point: 'Pettah',     end_point: 'Kottawa',        via: 'Nugegoda, Kohuwala' },
  { id: 'r005', route_number: '05',  route_name: 'Fort – Moratuwa',             start_point: 'Fort',       end_point: 'Moratuwa',       via: 'Galle Road' },
  { id: 'r006', route_number: '06',  route_name: 'Fort – Dehiwala',             start_point: 'Fort',       end_point: 'Dehiwala',       via: 'Galle Road' },
  { id: 'r001', route_number: '01',  route_name: 'Fort – Galle Express',        start_point: 'Fort',       end_point: 'Galle',          via: 'Hikkaduwa' },
  { id: 'r002', route_number: '02',  route_name: 'Fort – Kandy (via Kadugannawa)',start_point: 'Fort',     end_point: 'Kandy',          via: 'Kadugannawa' },
  { id: 'r014', route_number: '14',  route_name: 'Pettah – Kelaniya',           start_point: 'Pettah',     end_point: 'Kelaniya',       via: 'Kelani Bridge' },
  { id: 'r100', route_number: '100', route_name: 'Fort – Kurunegala',           start_point: 'Fort',       end_point: 'Kurunegala',     via: 'Katugastota' },
  { id: 'r138', route_number: '138', route_name: 'Fort – Maharagama',           start_point: 'Fort',       end_point: 'Maharagama',     via: 'Nugegoda' },
  { id: 'r187', route_number: '187', route_name: 'Fort – Battaramulla',         start_point: 'Fort',       end_point: 'Battaramulla',   via: 'Rajagiriya' },
  { id: 'r154', route_number: '154', route_name: 'Pettah – Kaduwela',           start_point: 'Pettah',     end_point: 'Kaduwela',       via: 'Kolonnawa' },
  { id: 'r122', route_number: '122', route_name: 'Pettah – Avissawella',        start_point: 'Pettah',     end_point: 'Avissawella',    via: 'Hanwella' },
  { id: 'r177', route_number: '177', route_name: 'Kaduwela – Kollupitiya',      start_point: 'Kaduwela',   end_point: 'Kollupitiya',    via: 'Rajagiriya' },
  { id: 'r190', route_number: '190', route_name: 'Meegoda – Pettah',            start_point: 'Meegoda',    end_point: 'Pettah',         via: 'Kaduwela' },
  { id: 'r400', route_number: '400', route_name: 'Fort – Negombo',              start_point: 'Fort',       end_point: 'Negombo',        via: 'Wattala' },
];

// 2–3 vehicles per route with realistic statuses
const VEHICLES = [
  // Route 48 – Fort/Kandy (very busy, some delays)
  { bus_number: 'NC-4801', route_number: '48', route_id: 'r048', status: 'active',   capacity: 54, booked_seats: 42 },
  { bus_number: 'NC-4802', route_number: '48', route_id: 'r048', status: 'delayed',  capacity: 54, booked_seats: 50 },
  { bus_number: 'NC-4803', route_number: '48', route_id: 'r048', status: 'active',   capacity: 54, booked_seats: 35 },

  // Route 17 – Pettah/Kottawa (urban, frequent)
  { bus_number: 'NC-1701', route_number: '17', route_id: 'r017', status: 'active',   capacity: 44, booked_seats: 38 },
  { bus_number: 'NC-1702', route_number: '17', route_id: 'r017', status: 'active',   capacity: 44, booked_seats: 30 },
  { bus_number: 'NC-1703', route_number: '17', route_id: 'r017', status: 'delayed',  capacity: 44, booked_seats: 44 },

  // Route 05 – Fort/Moratuwa (coastal, peak hours busy)
  { bus_number: 'NC-0501', route_number: '05', route_id: 'r005', status: 'active',   capacity: 50, booked_seats: 46 },
  { bus_number: 'NC-0502', route_number: '05', route_id: 'r005', status: 'active',   capacity: 50, booked_seats: 28 },

  // Route 06 – Fort/Dehiwala
  { bus_number: 'NC-0601', route_number: '06', route_id: 'r006', status: 'active',   capacity: 44, booked_seats: 33 },
  { bus_number: 'NC-0602', route_number: '06', route_id: 'r006', status: 'active',   capacity: 44, booked_seats: 20 },

  // Route 01 – Fort/Galle express
  { bus_number: 'NC-0101', route_number: '01', route_id: 'r001', status: 'active',   capacity: 54, booked_seats: 48 },
  { bus_number: 'NC-0102', route_number: '01', route_id: 'r001', status: 'delayed',  capacity: 54, booked_seats: 54 },

  // Route 02 – Fort/Kandy via Kadugannawa
  { bus_number: 'NC-0201', route_number: '02', route_id: 'r002', status: 'active',   capacity: 54, booked_seats: 40 },
  { bus_number: 'NC-0202', route_number: '02', route_id: 'r002', status: 'active',   capacity: 54, booked_seats: 22 },

  // Route 14 – Pettah/Kelaniya
  { bus_number: 'NC-1401', route_number: '14', route_id: 'r014', status: 'active',   capacity: 44, booked_seats: 36 },
  { bus_number: 'NC-1402', route_number: '14', route_id: 'r014', status: 'active',   capacity: 44, booked_seats: 18 },

  // Route 100 – Fort/Kurunegala
  { bus_number: 'NC-1001', route_number: '100', route_id: 'r100', status: 'active',  capacity: 54, booked_seats: 45 },
  { bus_number: 'NC-1002', route_number: '100', route_id: 'r100', status: 'delayed', capacity: 54, booked_seats: 50 },

  // Route 138 – Fort/Maharagama
  { bus_number: 'NC-1381', route_number: '138', route_id: 'r138', status: 'active',  capacity: 44, booked_seats: 39 },
  { bus_number: 'NC-1382', route_number: '138', route_id: 'r138', status: 'active',  capacity: 44, booked_seats: 25 },

  // Route 187 – Fort/Battaramulla
  { bus_number: 'NC-1871', route_number: '187', route_id: 'r187', status: 'active',  capacity: 44, booked_seats: 30 },
  { bus_number: 'NC-1872', route_number: '187', route_id: 'r187', status: 'active',  capacity: 44, booked_seats: 15 },

  // Route 154 – Pettah/Kaduwela
  { bus_number: 'NC-1541', route_number: '154', route_id: 'r154', status: 'active',  capacity: 44, booked_seats: 28 },

  // Route 122 – Pettah/Avissawella
  { bus_number: 'NC-1221', route_number: '122', route_id: 'r122', status: 'active',  capacity: 50, booked_seats: 34 },
  { bus_number: 'NC-1222', route_number: '122', route_id: 'r122', status: 'delayed', capacity: 50, booked_seats: 45 },

  // Route 177 – Kaduwela/Kollupitiya
  { bus_number: 'NC-1771', route_number: '177', route_id: 'r177', status: 'active',  capacity: 44, booked_seats: 22 },

  // Route 190 – Meegoda/Pettah
  { bus_number: 'NC-1901', route_number: '190', route_id: 'r190', status: 'active',  capacity: 44, booked_seats: 19 },

  // Route 400 – Fort/Negombo
  { bus_number: 'NC-4001', route_number: '400', route_id: 'r400', status: 'active',  capacity: 54, booked_seats: 41 },
  { bus_number: 'NC-4002', route_number: '400', route_id: 'r400', status: 'delayed', capacity: 54, booked_seats: 52 },
];

async function seed() {
  console.log('Seeding routes...');
  const routeBatch = db.batch();
  for (const route of ROUTES) {
    const { id, ...data } = route;
    routeBatch.set(db.collection('routes').doc(id), data);
  }
  await routeBatch.commit();
  console.log(`  ✓ ${ROUTES.length} routes written`);

  console.log('Seeding vehicles...');
  const vehicleBatch = db.batch();
  for (const vehicle of VEHICLES) {
    vehicleBatch.set(db.collection('vehicles').doc(), vehicle);
  }
  await vehicleBatch.commit();
  console.log(`  ✓ ${VEHICLES.length} vehicles written`);

  console.log('Done!');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
