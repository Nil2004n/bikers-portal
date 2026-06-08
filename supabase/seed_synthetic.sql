-- ═══════════════════════════════════════════════════════════════════════
-- Bikers Portal · synthetic content seed
-- Run AFTER follows.sql (so the 5 demo users exist in auth.users).
-- Adds a realistic spread of bikes, routes, journal posts, likes, and
-- comments tied to the demo accounts.
--
-- Idempotency: the script is guarded by a marker post whose content
-- starts with '__SEED_MARKER__'. If that row exists, the script emits
-- a NOTICE and exits without inserting anything. To reseed, run the
-- cleanup block at the bottom of this file first.
--
-- UUIDs: derived from md5('<table>-<email>-<slot>') so re-seeds (after
-- cleanup) reproduce the same primary keys, keeping any external
-- references stable.
-- ═══════════════════════════════════════════════════════════════════════

do $$
declare
  v_marker text := '__SEED_MARKER__ do not delete — guards the synthetic seed';
  v_count  int;
  -- resolved user ids (one query, reused below)
  u_arjun  uuid := (select id from auth.users where email = 'arjun@bikersportal.app');
  u_priya  uuid := (select id from auth.users where email = 'priya@bikersportal.app');
  u_rohan  uuid := (select id from auth.users where email = 'rohan@bikersportal.app');
  u_kavya  uuid := (select id from auth.users where email = 'kavya@bikersportal.app');
  u_vikram uuid := (select id from auth.users where email = 'vikram@bikersportal.app');
begin
  -- ── Guard: bail if we've already seeded ──────────────────────────────
  select count(*) into v_count
  from   public.posts
  where  content like v_marker || '%';
  if v_count > 0 then
    raise notice 'Synthetic seed already present (marker row found). Skipping.';
    raise notice 'To reseed, run the cleanup block at the bottom of this file first.';
    return;
  end if;

  -- ── Guard: bail if the demo users are missing ────────────────────────
  if u_arjun is null or u_priya is null or u_rohan is null or u_kavya is null or u_vikram is null then
    raise notice 'Demo users not found in auth.users. Run follows.sql first (block 5a provisions them).';
    return;
  end if;

  -- ── 1. Bikes (3 per rider, 15 total) ─────────────────────────────────
  insert into public.bikes (id, user_id, make, model, year, engine_cc, color, description, photo_url, created_at)
  values
    -- arjun
    (md5('bikes-arjun-1')::uuid, u_arjun, 'Royal Enfield', 'Interceptor 650', 2023, 648, 'Baker Express Red',
     'Daily ride. Twin exhaust. Rack for the saddle bag.', null, now() - interval '90 days'),
    (md5('bikes-arjun-2')::uuid, u_arjun, 'Yezdi', 'Roadster', 2024, 334, 'Smoke Grey',
     'Weekend canyon runs. Light, flickable, slightly underpowered on the highway.', null, now() - interval '40 days'),
    (md5('bikes-arjun-3')::uuid, u_arjun, 'Honda', 'CB350RS', 2022, 348, 'Black',
     'Sold last monsoon. Miss the thump.', null, now() - interval '420 days'),
    -- priya
    (md5('bikes-priya-1')::uuid, u_priya, 'KTM', '390 Duke', 2024, 373, 'Electronic Orange',
     'The orange one. Loud, sharp, hates rain.', null, now() - interval '120 days'),
    (md5('bikes-priya-2')::uuid, u_priya, 'Triumph', 'Speed 400', 2024, 398, 'Khaki Green',
     'Newest addition. Still in the break-in period.', null, now() - interval '25 days'),
    (md5('bikes-priya-3')::uuid, u_priya, 'Royal Enfield', 'Himalayan 450', 2024, 452, 'Sherpa Blue',
     'For the Ladakh plan. Hasn’t left the city yet.', null, now() - interval '10 days'),
    -- rohan
    (md5('bikes-rohan-1')::uuid, u_rohan, 'Triumph', 'Bonneville T100', 2021, 900, 'Aegean Blue',
     'The gentleman’s thumper. Polished every Sunday.', null, now() - interval '600 days'),
    (md5('bikes-rohan-2')::uuid, u_rohan, 'Ducati', 'Scrambler Icon', 2023, 803, '62 Yellow',
     'Weekend toy. Tank dented by my own stupidity.', null, now() - interval '200 days'),
    (md5('bikes-rohan-3')::uuid, u_rohan, 'Jawa', '42 Bobber', 2020, 293, 'Midnight Black',
     'Sold to fund the Ducati. Sometimes I regret it.', null, now() - interval '800 days'),
    -- kavya
    (md5('bikes-kavya-1')::uuid, u_kavya, 'Honda', 'CB350RS', 2023, 348, 'Rebel Red Metallic',
     'The mileage queen. Goes to the office and back.', null, now() - interval '300 days'),
    (md5('bikes-kavya-2')::uuid, u_kavya, 'Suzuki', 'V-Strom 250', 2024, 249, 'Champion Yellow',
     'Touring rig. Saddle bags permanently mounted.', null, now() - interval '150 days'),
    (md5('bikes-kavya-3')::uuid, u_kavya, 'KTM', 'RC 200', 2019, 199, 'Dark Galvano',
     'Sold during the move. Track day memories only.', null, now() - interval '1000 days'),
    -- vikram
    (md5('bikes-vikram-1')::uuid, u_vikram, 'Bajaj', 'Dominar 400', 2022, 373, 'Twilight Plum',
     'Long distance hauler. The pillion seat is actually comfortable.', null, now() - interval '500 days'),
    (md5('bikes-vikram-2')::uuid, u_vikram, 'Royal Enfield', 'Meteor 350', 2023, 349, 'Fireball Matte Blue',
     'Slow rides, long talks. My father taught me on one of these.', null, now() - interval '80 days'),
    (md5('bikes-vikram-3')::uuid, u_vikram, 'Yamaha', 'MT-15', 2024, 155, 'Ice Fluo Vermillion',
     'City runabout. Red lights, fast gaps.', null, now() - interval '5 days')
  on conflict (id) do nothing;

  -- ── 2. Trips (3 per rider, 15 total) ─────────────────────────────────
  insert into public.trips (id, user_id, title, start_loc, end_loc, distance_km, trip_date, difficulty, is_public, notes, waypoints, created_at)
  values
    -- arjun
    (md5('trips-arjun-1')::uuid, u_arjun, 'Pune → Lonavala · Sunday morning run', 'Pune, MH', 'Lonavala, MH',
     120, '2025-09-14'::date, 'Easy', true,
     'Left at 5:40. Tiger Point was already crowded by 7. Bypass road is still broken in three places.',
     '[{"name":"Tiger Point","km":50},{"name":"Lonavala Lake","km":110}]'::jsonb, now() - interval '20 days'),
    (md5('trips-arjun-2')::uuid, u_arjun, 'Bangalore → Coorg · two-up weekend', 'Bangalore, KA', 'Madikeri, KA',
     265, '2025-08-23'::date, 'Medium', true,
     'Sakleshpur ghat is overrated. The climb from Kushalnagar is the real one.',
     '[{"name":"Sakleshpur","km":120},{"name":"Madikeri","km":265}]'::jsonb, now() - interval '50 days'),
    (md5('trips-arjun-3')::uuid, u_arjun, 'Mumbai → Nashik · monsoon trial run', 'Mumbai, MH', 'Nashik, MH',
     167, '2025-07-12'::date, 'Medium', true,
     'Wipers gave up at Kasara. VFM, would not recommend in July.',
     '[{"name":"Kasara Ghat","km":80},{"name":"Igatpuri","km":120}]'::jsonb, now() - interval '90 days'),
    -- priya
    (md5('trips-priya-1')::uuid, u_priya, 'Delhi → Jaipur · breakfast run', 'Delhi, DL', 'Jaipur, RJ',
     281, '2025-10-05'::date, 'Easy', true,
     'Stopped for chai at Neemrana. Got there before lunch. Came back the same day.',
     '[{"name":"Neemrana","km":120},{"name":"Behror","km":160}]'::jsonb, now() - interval '10 days'),
    (md5('trips-priya-2')::uuid, u_priya, 'Manali → Spiti · the long loop', 'Manali, HP', 'Kaza, HP',
     420, '2025-06-18'::date, 'Hard', true,
     'Kunzum Pass in early season. Rohtang was a parking lot. Worth it though.',
     '[{"name":"Kunzum Pass","km":210},{"name":"Chandratal","km":300},{"name":"Kaza","km":420}]'::jsonb, now() - interval '180 days'),
    (md5('trips-priya-3')::uuid, u_priya, 'Pondicherry → Auroville · weekend loop', 'Pondicherry, PY', 'Auroville, PY',
     14, '2025-10-18'::date, 'Easy', false,
     'Coffee at Auroville bakery. Quiet road along the coast. Personal favorite.',
     '[{"name":"Auroville Bakery","km":10}]'::jsonb, now() - interval '3 days'),
    -- rohan
    (md5('trips-rohan-1')::uuid, u_rohan, 'Bangalore → Chikmagalur · estate roads', 'Bangalore, KA', 'Chikmagalur, KA',
     245, '2025-09-28'::date, 'Medium', true,
     'Mudigere → Belur is the prettiest 30 km in the state. Fight me.',
     '[{"name":"Mudigere","km":180},{"name":"Belur","km":210}]'::jsonb, now() - interval '12 days'),
    (md5('trips-rohan-2')::uuid, u_rohan, 'Coimbatore → Ooty · 36 hairpins', 'Coimbatore, TN', 'Ooty, TN',
     90, '2025-05-04'::date, 'Hard', true,
     'Counted them. It’s 39 if you take the right exits. Cold at the top.',
     '[{"name":"Coonoor","km":55},{"name":"Ooty","km":90}]'::jsonb, now() - interval '220 days'),
    (md5('trips-rohan-3')::uuid, u_rohan, 'Hyderabad → Srisailam · night run', 'Hyderabad, TS', 'Srisailam, TS',
     213, '2025-11-01'::date, 'Medium', true,
     'Left at 3 am. Sunrise at the ghat. Forest road is mostly empty at that hour.',
     '[{"name":"Dindi","km":120},{"name":"Srisailam","km":213}]'::jsonb, now() - interval '240 days'),
    -- kavya
    (md5('trips-kavya-1')::uuid, u_kavya, 'Chennai → Pondicherry · ECR dawn ride', 'Chennai, TN', 'Pondicherry, PY',
     162, '2025-10-12'::date, 'Easy', true,
     'Started at 4. Hit Mahabs at sunrise. Back home before lunch.',
     '[{"name":"Mahabalipuram","km":55},{"name":"Auroville","km":140}]'::jsonb, now() - interval '5 days'),
    (md5('trips-kavya-2')::uuid, u_kavya, 'Kochi → Munnar · tea estate climb', 'Kochi, KL', 'Munnar, KL',
     130, '2025-09-02'::date, 'Medium', true,
     'Adimali → Munnar is the bit. Stop at the view point just before the town.',
     '[{"name":"Adimali","km":90},{"name":"Munnar","km":130}]'::jsonb, now() - interval '40 days'),
    (md5('trips-kavya-3')::uuid, u_kavya, 'Bengaluru → Goa · overnight halt at Gokarna', 'Bengaluru, KA', 'Gokarna, KA',
     485, '2025-04-12'::date, 'Hard', true,
     'First long ride after the move. Body hurt for three days after.',
     '[{"name":"Hubli","km":410},{"name":"Gokarna","km":485}]'::jsonb, now() - interval '430 days'),
    -- vikram
    (md5('trips-vikram-1')::uuid, u_vikram, 'Lucknow → Ayodhya · Ram Navami weekend', 'Lucknow, UP', 'Ayodhya, UP',
     135, '2025-04-06'::date, 'Easy', true,
     'Crowded. Worth it once. The new highway is actually well-surfaced.',
     '[{"name":"Barabanki","km":60},{"name":"Ayodhya","km":135}]'::jsonb, now() - interval '450 days'),
    (md5('trips-vikram-2')::uuid, u_vikram, 'Chandigarh → Spiti · seven day loop', 'Chandigarh, CH', 'Kaza, HP',
     720, '2025-07-22'::date, 'Hard', true,
     'Worst roads of my life. Best views of my life. Bring spare brake pads.',
     '[{"name":"Narkanda","km":180},{"name":"Kalpa","km":340},{"name":"Tabo","km":580}]'::jsonb, now() - interval '300 days'),
    (md5('trips-vikram-3')::uuid, u_vikram, 'Jaipur → Pushkar · day trip with cousins', 'Jaipur, RJ', 'Pushkar, RJ',
     145, '2025-11-15'::date, 'Easy', true,
     'Two cousins on a Splendor. They kept up. Mildly impressive.',
     '[{"name":"Ajmer","km":130},{"name":"Pushkar","km":145}]'::jsonb, now() - interval '220 days')
  on conflict (id) do nothing;

  -- ── 3. Posts (4 per rider, 20 total) ─────────────────────────────────
  -- The marker post (one per rider) is what the guard above checks for.
  insert into public.posts (id, user_id, content, image_url, created_at)
  values
    -- arjun
    (md5('posts-arjun-marker')::uuid, u_arjun, v_marker || ' (arjun)', null, now() - interval '180 days'),
    (md5('posts-arjun-1')::uuid, u_arjun, 'She said the road was a metaphor. I told her the road was a road. We argued for 40 km.', null, now() - interval '14 days'),
    (md5('posts-arjun-2')::uuid, u_arjun, 'New chain on the Interceptor. Old one had stretched to “vibes-only” length.', null, now() - interval '6 days'),
    (md5('posts-arjun-3')::uuid, u_arjun, 'Lonavala at 6 am. Three other bikes. Two VFM uncles. Worth the alarm.', null, now() - interval '2 days'),
    -- priya
    (md5('posts-priya-marker')::uuid, u_priya, v_marker || ' (priya)', null, now() - interval '180 days'),
    (md5('posts-priya-1')::uuid, u_priya, 'The 390 and I are on speaking terms again. Battery was the issue, not the bike.', null, now() - interval '11 days'),
    (md5('posts-priya-2')::uuid, u_priya, 'I bought the Triumph 400. My partner says I have a problem. The bike says I have a solution.', null, now() - interval '4 days'),
    (md5('posts-priya-3')::uuid, u_priya, 'Himalayan is loaded. Ladakh plan is back on. Insurance renewed. Worst case: Shimla.', null, now() - interval '1 day'),
    -- rohan
    (md5('posts-rohan-marker')::uuid, u_rohan, v_marker || ' (rohan)', null, now() - interval '180 days'),
    (md5('posts-rohan-1')::uuid, u_rohan, 'Sold the Jawa. The Ducati makes me feel less and smile more. Fair trade.', null, now() - interval '8 days'),
    (md5('posts-rohan-2')::uuid, u_rohan, 'The Bonneville is for sale. Don’t make me regret this. Asking price in bio.', null, now() - interval '3 days'),
    (md5('posts-rohan-3')::uuid, u_rohan, 'Spent Sunday polishing chrome. Some hobbies are pointless. That’s the point.', null, now() - interval '7 days'),
    -- kavya
    (md5('posts-kavya-marker')::uuid, u_kavya, v_marker || ' (kavya)', null, now() - interval '180 days'),
    (md5('posts-kavya-1')::uuid, u_kavya, 'Coastal Tamil Nadu is criminally underrated. Three hours from Chennai, ten years from the world.', null, now() - interval '9 days'),
    (md5('posts-kavya-2')::uuid, u_kavya, 'The V-Strom is a couch with a handlebar. I have ridden 200 km in a day and felt fine after.', null, now() - interval '5 days'),
    (md5('posts-kavya-3')::uuid, u_kavya, 'Gokarna → Karwar coast is my favourite stretch in India. Will die on this hill.', null, now() - interval '2 days'),
    -- vikram
    (md5('posts-vikram-marker')::uuid, u_vikram, v_marker || ' (vikram)', null, now() - interval '180 days'),
    (md5('posts-vikram-1')::uuid, u_vikram, 'The MT-15 is small. I am also not tall. We fit.', null, now() - interval '13 days'),
    (md5('posts-vikram-2')::uuid, u_vikram, 'Spiti. Day 4. No network. No complaints. Will write a long post when I’m back.', null, now() - interval '300 days'),
    (md5('posts-vikram-3')::uuid, u_vikram, 'Pillion life: trust the rider, check the bike. In that order.', null, now() - interval '1 day')
  on conflict (id) do nothing;

  -- ── 4. Likes (each non-marker post gets 3 random likes from other riders) ──
  insert into public.likes (post_id, user_id)
  select p.id, liker.id
  from   public.posts p
  cross join lateral (
    select id from auth.users
    where  email in (
      'arjun@bikersportal.app','priya@bikersportal.app','rohan@bikersportal.app',
      'kavya@bikersportal.app','vikram@bikersportal.app'
    )
    and id <> p.user_id
    order  by random()
    limit  3
  ) liker
  where  p.content not like v_marker || '%'
  on conflict (post_id, user_id) do nothing;

  -- ── 5. Comments (2 per non-marker post, from random other riders) ────
  with comment_seed as (
    select
      p.id as post_id,
      (select id from auth.users
       where email in ('arjun@bikersportal.app','priya@bikersportal.app','rohan@bikersportal.app',
                       'kavya@bikersportal.app','vikram@bikersportal.app')
         and id <> p.user_id
       order by random() limit 1) as author,
      row_number() over (partition by p.id order by random()) as rn
    from public.posts p
    where p.content not like v_marker || '%'
  )
  insert into public.comments (id, post_id, user_id, body, created_at)
  select gen_random_uuid(),
         cs.post_id,
         cs.author,
         (array[
           'Word. Felt this one.',
           'Saved for the next ride.',
           'That''s the take. Take care of the machine.',
           'Send route please.',
           'Sounds like a good day out.',
           'Where was this?',
           'I needed to read this today.',
           'Hell of a write-up.'
         ])[((cs.rn - 1) % 8) + 1],
         now() - (random() * interval '10 days')
  from   comment_seed cs
  where  cs.rn <= 2;

  raise notice 'Synthetic seed complete: 15 bikes · 15 routes · 20 posts · likes · comments.';
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- CLEANUP (uncomment to wipe all synthetic data, then re-run this file)
-- ═══════════════════════════════════════════════════════════════════════
--
-- delete from public.comments
--   where post_id in (select id from public.posts where id in (
--     md5('posts-arjun-marker')::uuid, md5('posts-priya-marker')::uuid,
--     md5('posts-rohan-marker')::uuid, md5('posts-kavya-marker')::uuid,
--     md5('posts-vikram-marker')::uuid
--   ));
-- delete from public.likes
--   where post_id in (select id from public.posts where id in (
--     md5('posts-arjun-marker')::uuid, md5('posts-priya-marker')::uuid,
--     md5('posts-rohan-marker')::uuid, md5('posts-kavya-marker')::uuid,
--     md5('posts-vikram-marker')::uuid
--   ));
-- delete from public.posts
--   where id in (
--     md5('posts-arjun-marker')::uuid, md5('posts-priya-marker')::uuid,
--     md5('posts-rohan-marker')::uuid, md5('posts-kavya-marker')::uuid,
--     md5('posts-vikram-marker')::uuid
--   ) or id in (
--     md5('posts-arjun-1')::uuid, md5('posts-arjun-2')::uuid, md5('posts-arjun-3')::uuid,
--     md5('posts-priya-1')::uuid, md5('posts-priya-2')::uuid, md5('posts-priya-3')::uuid,
--     md5('posts-rohan-1')::uuid, md5('posts-rohan-2')::uuid, md5('posts-rohan-3')::uuid,
--     md5('posts-kavya-1')::uuid, md5('posts-kavya-2')::uuid, md5('posts-kavya-3')::uuid,
--     md5('posts-vikram-1')::uuid, md5('posts-vikram-2')::uuid, md5('posts-vikram-3')::uuid
--   );
-- delete from public.trips     where id in (
--   md5('trips-arjun-1')::uuid,  md5('trips-arjun-2')::uuid,  md5('trips-arjun-3')::uuid,
--   md5('trips-priya-1')::uuid,  md5('trips-priya-2')::uuid,  md5('trips-priya-3')::uuid,
--   md5('trips-rohan-1')::uuid,  md5('trips-rohan-2')::uuid,  md5('trips-rohan-3')::uuid,
--   md5('trips-kavya-1')::uuid,  md5('trips-kavya-2')::uuid,  md5('trips-kavya-3')::uuid,
--   md5('trips-vikram-1')::uuid, md5('trips-vikram-2')::uuid, md5('trips-vikram-3')::uuid
-- );
-- delete from public.bikes     where id in (
--   md5('bikes-arjun-1')::uuid,  md5('bikes-arjun-2')::uuid,  md5('bikes-arjun-3')::uuid,
--   md5('bikes-priya-1')::uuid,  md5('bikes-priya-2')::uuid,  md5('bikes-priya-3')::uuid,
--   md5('bikes-rohan-1')::uuid,  md5('bikes-rohan-2')::uuid,  md5('bikes-rohan-3')::uuid,
--   md5('bikes-kavya-1')::uuid,  md5('bikes-kavya-2')::uuid,  md5('bikes-kavya-3')::uuid,
--   md5('bikes-vikram-1')::uuid, md5('bikes-vikram-2')::uuid, md5('bikes-vikram-3')::uuid
-- );
-- ═══════════════════════════════════════════════════════════════════════
