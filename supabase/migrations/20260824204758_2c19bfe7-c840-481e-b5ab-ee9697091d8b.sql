-- Downtime bookkeeping: how far the campaign's rent and Lifestyle are settled.
--
-- The campaign already carries a `day` counter (unused until now — downtime is
-- its first consumer, since resting is what makes days pass). Rent and Lifestyle
-- are printed as monthly costs, so what has to be remembered is the day through
-- which they are paid; everything else is derived from the day counter.
--
-- Defaults to 0 rather than to the end of the free first month. Characters get
-- their starting housing and Lifestyle free for the first month
-- (creation-rules.json → startingLifestyle.firstMonthFree), and the app applies
-- that when reading this column, so existing campaigns keep their free month
-- without a data backfill.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS bills_paid_through_day integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.campaigns.bills_paid_through_day IS
  'Day through which rent and Lifestyle are settled. 0 = nothing paid yet; the free first month is applied on read.';