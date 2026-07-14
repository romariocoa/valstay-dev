
-- Fix completed stays where actual checkout happened before the scheduled date.
-- Uses updated_at (converted to Lima time) as the real departure day.
-- Recalculates total_amount proportionally when available.

WITH early AS (
  SELECT
    id,
    check_in_date,
    check_out_date                                               AS scheduled_out,
    (updated_at AT TIME ZONE 'America/Lima')::date               AS actual_out,
    total_amount,
    (check_out_date - check_in_date)                             AS scheduled_nights,
    ((updated_at AT TIME ZONE 'America/Lima')::date - check_in_date) AS actual_nights
  FROM stays
  WHERE status = 'completed'
    AND (updated_at AT TIME ZONE 'America/Lima')::date < check_out_date
)
UPDATE stays s
SET
  check_out_date = e.actual_out,
  total_amount = CASE
    WHEN e.total_amount IS NOT NULL
         AND e.scheduled_nights > 0
         AND e.actual_nights >= 0
    THEN ROUND((e.actual_nights::numeric / e.scheduled_nights::numeric) * e.total_amount, 2)
    ELSE s.total_amount
  END
FROM early e
WHERE s.id = e.id;
