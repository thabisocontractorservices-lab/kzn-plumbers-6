-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill plumber.about for empty rows
--
-- WHY: Without unique body content per plumber profile, Google rejects them
-- with "Crawled - currently not indexed". This generates 4 different sentence
-- templates rotated by id hash so adjacent plumbers don't get identical text.
--
-- HOW TO RUN: Paste into Supabase Dashboard → SQL Editor → Run.
--
-- SAFE TO RE-RUN: only updates rows where about IS NULL or shorter than 50
-- chars. Doesn't overwrite plumbers who already have a real description.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── DRY RUN: preview 5 rows before committing ────────────────────────────────
-- Uncomment this block first to see sample output. If the copy reads well,
-- comment it back out and run the UPDATE below.

-- SELECT
--   trading_name,
--   area,
--   CASE (abs(hashtext(id::text)) % 4)
--     WHEN 0 THEN
--       trading_name || ' serves homeowners and small businesses in '
--       || area || ', KwaZulu-Natal, offering '
--       || COALESCE(array_to_string(specialties[1:3], ', '), 'professional plumbing services')
--       || '. '
--       || CASE WHEN is_certified THEN 'Registered with the Plumbing Industry Registration Board (PIRB). ' ELSE '' END
--       || CASE WHEN is_emergency THEN 'Available 24/7 for emergency call-outs.' ELSE 'Contact via WhatsApp for a quote.' END
--     WHEN 1 THEN
--       'Operating across ' || area || ' and the surrounding KZN region, '
--       || trading_name || ' specialises in '
--       || COALESCE(array_to_string(specialties[1:3], ', '), 'general plumbing')
--       || '. '
--       || CASE WHEN is_certified THEN 'Holds active PIRB certification for compliance work. ' ELSE 'Verified listing. ' END
--       || 'Request a no-obligation quote any time.'
--     WHEN 2 THEN
--       trading_name || ' is a '
--       || CASE WHEN is_certified THEN 'PIRB-certified ' ELSE 'verified ' END
--       || 'plumbing business based in ' || area || ', KwaZulu-Natal. Services include '
--       || COALESCE(array_to_string(specialties[1:3], ', '), 'standard residential plumbing')
--       || '. '
--       || CASE WHEN is_emergency THEN 'Emergency response 24 hours a day.' ELSE 'Quotes provided upfront.' END
--     ELSE
--       'Based in ' || area || ', '
--       || trading_name || ' has been providing '
--       || COALESCE(array_to_string(specialties[1:3], ', '), 'plumbing services')
--       || ' to homes and businesses in KwaZulu-Natal. '
--       || CASE WHEN is_certified THEN 'PIRB-registered for hot-water and compliance jobs. ' ELSE '' END
--       || 'Reach out via WhatsApp or phone for assistance.'
--   END AS proposed_about
-- FROM plumbers
-- WHERE (about IS NULL OR length(about) < 50)
--   AND trading_name IS NOT NULL
--   AND area IS NOT NULL
-- LIMIT 5;


-- ── COMMITTED UPDATE: applies the backfill to all eligible rows ──────────────
UPDATE plumbers
SET about = CASE (abs(hashtext(id::text)) % 4)
  WHEN 0 THEN
    trading_name || ' serves homeowners and small businesses in '
    || area || ', KwaZulu-Natal, offering '
    || COALESCE(array_to_string(specialties[1:3], ', '), 'professional plumbing services')
    || '. '
    || CASE WHEN is_certified THEN 'Registered with the Plumbing Industry Registration Board (PIRB). ' ELSE '' END
    || CASE WHEN is_emergency THEN 'Available 24/7 for emergency call-outs.' ELSE 'Contact via WhatsApp for a quote.' END
  WHEN 1 THEN
    'Operating across ' || area || ' and the surrounding KZN region, '
    || trading_name || ' specialises in '
    || COALESCE(array_to_string(specialties[1:3], ', '), 'general plumbing')
    || '. '
    || CASE WHEN is_certified THEN 'Holds active PIRB certification for compliance work. ' ELSE 'Verified listing. ' END
    || 'Request a no-obligation quote any time.'
  WHEN 2 THEN
    trading_name || ' is a '
    || CASE WHEN is_certified THEN 'PIRB-certified ' ELSE 'verified ' END
    || 'plumbing business based in ' || area || ', KwaZulu-Natal. Services include '
    || COALESCE(array_to_string(specialties[1:3], ', '), 'standard residential plumbing')
    || '. '
    || CASE WHEN is_emergency THEN 'Emergency response 24 hours a day.' ELSE 'Quotes provided upfront.' END
  ELSE
    'Based in ' || area || ', '
    || trading_name || ' has been providing '
    || COALESCE(array_to_string(specialties[1:3], ', '), 'plumbing services')
    || ' to homes and businesses in KwaZulu-Natal. '
    || CASE WHEN is_certified THEN 'PIRB-registered for hot-water and compliance jobs. ' ELSE '' END
    || 'Reach out via WhatsApp or phone for assistance.'
  END
WHERE (about IS NULL OR length(about) < 50)
  AND trading_name IS NOT NULL
  AND area IS NOT NULL;

-- After running, verify the update count and spot-check a few rows:
-- SELECT trading_name, area, about FROM plumbers WHERE about IS NOT NULL ORDER BY random() LIMIT 5;
