// ════════════════════════════════════════════════════════════════
// Bikers Portal — Seed sample data
// ════════════════════════════════════════════════════════════════
// Usage:
//   node server/seed.js            # seed only if empty
//   node server/seed.js --reset    # wipe + reseed
// ════════════════════════════════════════════════════════════════
import { db, initSchema, uid, now } from './db.js'
import { hashPassword } from './auth.js'

const RESET = process.argv.includes('--reset')
initSchema()

if (RESET) {
  console.log('• wiping existing data…')
  db.exec(`
    DELETE FROM comments;
    DELETE FROM likes;
    DELETE FROM trips;
    DELETE FROM bikes;
    DELETE FROM posts;
    DELETE FROM sessions;
    DELETE FROM profiles;
  `)
}

const existing = db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n
if (existing > 0 && !RESET) {
  console.log(`• profiles already present (${existing}) — use --reset to wipe`)
  process.exit(0)
}

// ── Riders ──────────────────────────────────────────────────
const riders = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'arjun',
    full_name: 'Arjun Mehta',
    bio: 'Long-distance rider. Royal Enfield at heart, mountains in mind. Tea over coffee, always.',
    bike_model: 'Royal Enfield Interceptor 650',
    password: 'siliguri',
    avatar_seed: 'AM'
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    username: 'mira',
    full_name: 'Mira Kothari',
    bio: 'Heritage machines, heritage roads. I write about the long way home.',
    bike_model: 'Triumph Bonneville T100',
    password: 'darjeeling',
    avatar_seed: 'MK'
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    username: 'rohan',
    full_name: 'Rohan Iyer',
    bio: 'Twenty years on two wheels. The Workshop is my second garage.',
    bike_model: 'BMW R 1250 GS',
    password: 'coorg',
    avatar_seed: 'RI'
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    username: 'ishita',
    full_name: 'Ishita Rao',
    bio: 'Dust, diesel, and a quiet throttle. Spiti at first light.',
    bike_model: 'Royal Enfield Himalayan 450',
    password: 'spiti',
    avatar_seed: 'IR'
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    username: 'vikram',
    full_name: 'Vikram Singh',
    bio: 'Desert routes and the smell of petrichor. The road is the destination.',
    bike_model: 'Harley-Davidson Fat Boy',
    password: 'jaisalmer',
    avatar_seed: 'VS'
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    username: 'anika',
    full_name: 'Anika Pillai',
    bio: 'Coffee stops every hundred kilometres. Coorg is a feeling.',
    bike_model: 'Triumph Tiger 900',
    password: 'chikmagalur',
    avatar_seed: 'AP'
  }
]

const insertProfile = db.prepare(`
  INSERT INTO profiles (id, username, full_name, bio, bike_model, avatar_url, password_hash, password_salt, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const ts = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  return d.toISOString()
}

console.log('• seeding profiles…')
for (const r of riders) {
  const { hash, salt } = hashPassword(r.password)
  insertProfile.run(
    r.id, r.username, r.full_name, r.bio, r.bike_model, null,
    hash, salt, ts(riders.indexOf(r) * 4 + 30)
  )
  console.log(`  ✓ ${r.username.padEnd(8)} (${r.full_name})  · password: ${r.password}`)
}

// ── Posts ───────────────────────────────────────────────────
const posts = [
  { user: 'arjun',  text: "Dawn departure from Siliguri. Cold air, empty road, and the Interceptor settling into its rhythm by the fourth gear pull." },
  { user: 'mira',   text: "Stopped at a roadside chai stall somewhere between Kurseong and Sonada. The kettle has been on for thirty years. Some things do not need to change." },
  { user: 'rohan',  text: "Twenty years of riding, and the GS still teaches me something every morning. Today: patience on wet cobblestone." },
  { user: 'ishita', text: "Crossing Kunzum at 4,500 metres. The Himalayan 450 didn't flinch. I did." },
  { user: 'vikram', text: "The Thar at sunset is a colour only film used to render correctly. Now I understand why my grandfather drove these roads." },
  { user: 'anika',  text: "Chikmagalur in the monsoon. Coffee, cardamom, and twenty switchbacks before lunch." }
]

const insertPost = db.prepare(`
  INSERT INTO posts (id, user_id, content, image_url, created_at)
  VALUES (?, ?, ?, ?, ?)
`)
console.log('• seeding posts…')
posts.forEach((p, i) => {
  const u = riders.find(r => r.username === p.user)
  insertPost.run(uid(), u.id, p.text, null, ts(posts.length - i))
})

// ── Likes & comments ────────────────────────────────────────
const insertLike = db.prepare('INSERT INTO likes (id, post_id, user_id, created_at) VALUES (?, ?, ?, ?)')
const insertComment = db.prepare(`
  INSERT INTO comments (id, post_id, user_id, body, created_at)
  VALUES (?, ?, ?, ?, ?)
`)

console.log('• seeding likes & comments…')
const allPosts = db.prepare('SELECT id FROM posts ORDER BY created_at DESC').all()
const allUsers = riders.map(r => r.id)

// 1) On the most recent post (Arjun's dawn departure), add Mira's like + comment
const first = allPosts[0]
insertLike.run(uid(), first.id, riders[1].id, ts(0))
insertComment.run(uid(), first.id, riders[1].id, "That first-light departure is always the finest part of the day.", ts(0))

// 2) Sprinkle a few likes & comments across other posts
for (let i = 1; i < allPosts.length; i++) {
  const liker = allUsers[(i + 1) % allUsers.length]
  insertLike.run(uid(), allPosts[i].id, liker, ts(i * 2))
  if (i % 2 === 0) {
    const commenter = allUsers[(i + 2) % allUsers.length]
    insertComment.run(uid(), allPosts[i].id, commenter,
      ['A road worth remembering.', 'Truly.', 'Save this one for a quiet weekend.', 'Pre-ride checklist before anything else.'][i % 4],
      ts(i * 2)
    )
  }
}

// ── Bikes ───────────────────────────────────────────────────
const insertBike = db.prepare(`
  INSERT INTO bikes (id, user_id, make, model, year, engine_cc, color, description, photo_url, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
console.log('• seeding bikes…')
const bikes = [
  { u: 'arjun',  make: 'Royal Enfield', model: 'Interceptor 650', year: 2024, cc: 648, color: 'Canyon Red',    desc: 'Balanced highway machine with vintage soul and modern road manners. The thumper is gone, the charm remains.' },
  { u: 'mira',   make: 'Triumph',       model: 'Bonneville T100', year: 2022, cc: 900, color: 'Aegean Blue',   desc: 'Twin shocks, polished cases, and a riding position that never tires. I do not hurry, and neither does she.' },
  { u: 'rohan',  make: 'BMW Motorrad',  model: 'R 1250 GS',       year: 2023, cc: 1254, color: 'Triple Black',  desc: 'Twenty years of touring, distilled. The Telelever front end is the most honest fork in motorcycling.' },
  { u: 'ishita', make: 'Royal Enfield', model: 'Himalayan 450',   year: 2024, cc: 452, color: 'Hanle Black',   desc: 'Built for roads that have not heard of asphalt. Sherpa-grade companion.' },
  { u: 'vikram', make: 'Harley-Davidson', model: 'Fat Boy',       year: 2021, cc: 1868, color: 'Vivid Black',   desc: 'A boulevard cruiser for a man who already has two long-distance bikes. Some machines are kept for the weight of them.' },
  { u: 'anika',  make: 'Triumph',       model: 'Tiger 900',       year: 2023, cc: 888, color: 'Korosi Red',    desc: 'Three cylinders, an upright stance, and enough ground clearance to be honest in the Western Ghats.' },
  { u: 'arjun',  make: 'Ducati',        model: 'Scrambler Icon',  year: 2019, cc: 803, color: 'Yellow',        desc: 'The second machine. For weekends when the Interceptor feels too grown up.' }
]
bikes.forEach((b, i) => {
  const u = riders.find(r => r.username === b.u)
  insertBike.run(uid(), u.id, b.make, b.model, b.year, b.cc, b.color, b.desc, null, ts(bikes.length - i))
})

// ── Trips ───────────────────────────────────────────────────
const insertTrip = db.prepare(`
  INSERT INTO trips (id, user_id, title, start_loc, end_loc, waypoints, distance_km, trip_date, difficulty, notes, is_public, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
console.log('• seeding trips…')
const trips = [
  { u: 'arjun',  title: 'Darjeeling Dawn Run',         start: 'Siliguri, WB',   end: 'Darjeeling, WB',  waypoints: [{km:30,name:'Kurseong'},{km:52,name:'Sonada'}], km: 72,  date: '2026-06-19', diff: 'Medium', notes: 'Early departure, layered clothing, no rushed overtakes.', public: true },
  { u: 'mira',   title: 'Coorg Coffee Trail',          start: 'Mysuru, KA',     end: 'Madikeri, KA',    waypoints: [{km:60,name:'Siddapur'},{km:95,name:'Kushalnagar'}], km: 120, date: '2026-07-12', diff: 'Easy',   notes: 'Two coffee stops minimum. Plan for the slow road, not the highway.', public: true },
  { u: 'rohan',  title: 'Manali — Leh via Rohtang',    start: 'Manali, HP',      end: 'Leh, Ladakh',     waypoints: [{km:51,name:'Marhi'},{km:130,name:'Keylong'},{km:225,name:'Sarchu'},{km:300,name:'Pang'}], km: 480, date: '2026-08-04', diff: 'Hard',   notes: 'Two full days minimum. Acclimatise at Keylong.', public: true },
  { u: 'ishita', title: 'Spiti — The Cold Desert',      start: 'Shimla, HP',      end: 'Kaza, HP',        waypoints: [{km:110,name:'Narkanda'},{km:200,name:'Rampur'},{km:300,name:'Sarahan'},{km:380,name:'Kalpa'},{km:460,name:'Nako'}], km: 510, date: '2026-09-18', diff: 'Hard', notes: 'Fuel at Rampur and Kalpa. Carry water for the upper stretches.', public: true },
  { u: 'vikram', title: 'Jaisalmer Dunes Loop',        start: 'Jodhpur, RJ',     end: 'Jaisalmer, RJ',   waypoints: [{km:140,name:'Pokhran'},{km:200,name:'Khuri'}], km: 330, date: '2026-11-22', diff: 'Medium', notes: 'Winter only. The dunes are honest when the wind is not.', public: true },
  { u: 'anika',  title: 'Chikmagalur Weekend',         start: 'Bengaluru, KA',   end: 'Chikmagalur, KA', waypoints: [{km:140,name:'Hassan'},{km:220,name:'Belur'}], km: 250, date: '2026-06-29', diff: 'Medium', notes: 'Avoid weekends. The Hassan road closes for repairs intermittently.', public: false },
  { u: 'arjun',  title: 'Sikkim — Old Silk Route',     start: 'Siliguri, WB',    end: 'Gangtok, SK',     waypoints: [{km:55,name:'Sevoke'},{km:90,name:'Kalijhora'},{km:120,name:'Melli'}], km: 145, date: '2026-10-04', diff: 'Medium', notes: 'Permits required. Apply two weeks in advance.', public: false }
]
trips.forEach((t, i) => {
  const u = riders.find(r => r.username === t.u)
  insertTrip.run(
    uid(), u.id, t.title, t.start, t.end, JSON.stringify(t.waypoints), t.km, t.date, t.diff, t.notes, t.public ? 1 : 0,
    ts(trips.length - i)
  )
})

// ── Summary ────────────────────────────────────────────────
const counts = {
  profiles: db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n,
  posts:    db.prepare('SELECT COUNT(*) AS n FROM posts').get().n,
  bikes:    db.prepare('SELECT COUNT(*) AS n FROM bikes').get().n,
  trips:    db.prepare('SELECT COUNT(*) AS n FROM trips').get().n,
  likes:    db.prepare('SELECT COUNT(*) AS n FROM likes').get().n,
  comments: db.prepare('SELECT COUNT(*) AS n FROM comments').get().n
}
console.log('')
console.log('  Seeded counts:', counts)
console.log('')
console.log('  Test logins:')
console.log('    arjun   / siliguri')
console.log('    mira    / darjeeling')
console.log('    rohan   / coorg')
console.log('    ishita  / spiti')
console.log('    vikram  / jaisalmer')
console.log('    anika   / chikmagalur')
console.log('')
