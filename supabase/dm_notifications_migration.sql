-- ============================================================
-- DM & NOTIFICATIONS MIGRATION
-- Bikers Portal · Supabase SQL
-- ============================================================

-- STEP 1: Conversations Table
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  participant_1 uuid not null references public.profiles(id) on delete cascade,
  participant_2 uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint participants_ordered check (participant_1 < participant_2),
  constraint unique_conversation unique (participant_1, participant_2)
);

-- STEP 2: Messages Table
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  content         text not null check (char_length(content) between 1 and 2000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- STEP 3: Notifications Table
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  type        text not null check (type in (
                'like','comment','follow','follow_request','mention','message','trip_invite'
              )),
  entity_type text check (entity_type in ('post','bike','trip','conversation','profile')),
  entity_id   uuid,
  message     text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- STEP 4: Indexes
create index if not exists idx_messages_conversation
  on public.messages(conversation_id, created_at asc);

create index if not exists idx_messages_sender
  on public.messages(sender_id);

create index if not exists idx_notifications_user_time
  on public.notifications(user_id, created_at desc);

create index if not exists idx_notifications_unread
  on public.notifications(user_id, read_at)
  where read_at is null;

create index if not exists idx_conversations_p1
  on public.conversations(participant_1);

create index if not exists idx_conversations_p2
  on public.conversations(participant_2);

-- STEP 5: Row Level Security

-- Conversations
alter table public.conversations enable row level security;

create policy "conversation_select" on public.conversations
  for select using (
    auth.uid() = participant_1 or auth.uid() = participant_2
  );

create policy "conversation_insert" on public.conversations
  for insert with check (
    auth.uid() = participant_1 or auth.uid() = participant_2
  );

-- Messages
alter table public.messages enable row level security;

create policy "message_select" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
    )
  );

create policy "message_insert" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
    )
  );

-- Notifications
alter table public.notifications enable row level security;

create policy "notification_select" on public.notifications
  for select using (auth.uid() = user_id);

create policy "notification_update" on public.notifications
  for update using (auth.uid() = user_id);

-- STEP 6: Postgres Triggers (Auto-generate notifications)

-- Helper: safe insert notification (avoids duplicates)
create or replace function public.create_notification(
  p_user_id     uuid,
  p_actor_id    uuid,
  p_type        text,
  p_entity_type text,
  p_entity_id   uuid,
  p_message     text default null
) returns void language plpgsql security definer as $$
begin
  if p_user_id = p_actor_id then return; end if;

  insert into public.notifications(user_id, actor_id, type, entity_type, entity_id, message)
  values (p_user_id, p_actor_id, p_type, p_entity_type, p_entity_id, p_message);
end;
$$;

-- Trigger: notify on new follow
create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer as $$
begin
  perform public.create_notification(
    NEW.following_id,
    NEW.follower_id,
    'follow',
    'profile',
    NEW.following_id,
    null
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_follow on public.follows;
create trigger trg_notify_follow
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- Trigger: notify on new DM
create or replace function public.notify_on_message()
returns trigger language plpgsql security definer as $$
declare
  v_recipient uuid;
begin
  select case
    when c.participant_1 = NEW.sender_id then c.participant_2
    else c.participant_1
  end into v_recipient
  from public.conversations c
  where c.id = NEW.conversation_id;

  perform public.create_notification(
    v_recipient,
    NEW.sender_id,
    'message',
    'conversation',
    NEW.conversation_id,
    left(NEW.content, 80)
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message
  after insert on public.messages
  for each row execute function public.notify_on_message();

-- STEP 7: Enable Realtime on new tables
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;

-- STEP 8: Seed synthetic DM data (for testing)
do $$
declare
  v_p1 uuid;
  v_p2 uuid;
  v_conv uuid;
begin
  select id into v_p1 from public.profiles order by created_at limit 1;
  select id into v_p2 from public.profiles order by created_at limit 1 offset 1;

  if v_p1 > v_p2 then
    select v_p1, v_p2 into v_p2, v_p1;
  end if;

  insert into public.conversations(participant_1, participant_2)
  values (v_p1, v_p2)
  returning id into v_conv;

  insert into public.messages(conversation_id, sender_id, content, created_at) values
    (v_conv, v_p1, 'Bhai, did you take the Spiti Valley route last month?',           now() - interval '2 hours'),
    (v_conv, v_p2, 'Yes! Kaza to Manali in one shot. Brutal but worth it.',            now() - interval '1 hour 50 min'),
    (v_conv, v_p1, 'What bike were you on?',                                           now() - interval '1 hour 40 min'),
    (v_conv, v_p2, 'Himalayan 450. Handled the altitude beautifully.',                 now() - interval '1 hour 30 min'),
    (v_conv, v_p1, 'Nice. I am planning the same in October. Want to ride together?',  now() - interval '1 hour'),
    (v_conv, v_p2, 'Absolutely. Let us plan a trip on the portal.',                    now() - interval '30 min');

  raise notice 'Seeded conversation % between % and %', v_conv, v_p1, v_p2;
end;
$$;
