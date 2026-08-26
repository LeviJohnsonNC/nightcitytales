-- campaign_factions has been carrying a standing column that nothing read and
-- nothing wrote. The clocks work starts writing it, so it needs the same
-- guarantee campaign_npcs and campaign_clocks already have: one row per faction
-- per campaign.
--
-- Without it an upsert has nothing to conflict on, and two writes in the same
-- turn would file a second row for the same organisation. A faction's opinion
-- of you split across two numbers is the exact bug this system exists to avoid.
--
-- Written to be safe to run more than once, like the other migrations here: a
-- replay must not fail on "constraint already exists".

-- Fold any duplicates that predate the constraint into the row that was written
-- first, keeping the strongest opinion rather than whichever landed last.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY campaign_id, faction_id
      ORDER BY abs(standing) DESC, id
    ) AS rank
  FROM public.campaign_factions
)
DELETE FROM public.campaign_factions
WHERE id IN (SELECT id FROM ranked WHERE rank > 1);

-- A unique INDEX rather than a unique CONSTRAINT: it takes IF NOT EXISTS, and
-- ON CONFLICT (campaign_id, faction_id) resolves against it just the same.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_factions_campaign_id_faction_id_key
  ON public.campaign_factions (campaign_id, faction_id);

-- The engine's scale (engine/factions.ts) is -10..10. Mirrored here so a bad
-- write is refused by the database rather than quietly stored out of range.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_factions_standing_range'
      AND conrelid = 'public.campaign_factions'::regclass
  ) THEN
    -- Clamp anything already out of range, or the constraint cannot be added.
    UPDATE public.campaign_factions
    SET standing = GREATEST(-10, LEAST(10, standing))
    WHERE standing < -10 OR standing > 10;

    ALTER TABLE public.campaign_factions
      ADD CONSTRAINT campaign_factions_standing_range
      CHECK (standing BETWEEN -10 AND 10);
  END IF;
END $$;