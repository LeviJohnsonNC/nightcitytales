-- The opening's "just living" door is a premise, not something owed.
--
-- `seedJustLiving` wrote it with `due_day` set to the day the campaign opened,
-- which made the status rail count it: a fresh game opened on "1 open · 1 due
-- today" over a summary reading "Nobody is expecting you anywhere tonight."
-- The money chip then led with it too, because the nearest dated `need` is what
-- that chip counts down to, so the balance line said the apartment was due.
--
-- The seed no longer sets a due day and marks the row `data.premise`, which the
-- status rail reads to leave it out of the commitments count. Campaigns that
-- already took this door carry the old row, so this repairs them in place.
--
-- Narrow on purpose: one situation key, and only rows that still look like what
-- the seed wrote. A campaign whose "just living" situation has since been
-- closed keeps its status; nothing here touches any other situation.

UPDATE public.campaign_situations
SET
  due_day = NULL,
  data = COALESCE(data, '{}'::jsonb) || '{"premise": true}'::jsonb
WHERE situation_key = 'opening_just_living';
