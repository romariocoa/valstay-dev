-- Normalize all completed stays: check_out_date now stores the LAST NIGHT slept (inclusive),
-- not the departure day. Subtract 1 day from every completed record so the
-- stored value matches what is shown to the user.
UPDATE stays
SET check_out_date = check_out_date - INTERVAL '1 day'
WHERE status = 'completed';
