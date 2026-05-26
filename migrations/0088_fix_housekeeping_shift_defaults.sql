UPDATE schedule_shift_types
SET end_time = '15:00',
    updated_at = now()
WHERE upper(label) = 'LAUNDRY'
  AND start_time = '08:00'
  AND end_time = '16:00';
