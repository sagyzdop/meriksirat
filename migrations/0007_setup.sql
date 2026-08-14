UPDATE `booking`
SET `status` = (
  SELECT CASE
    WHEN SUM(CASE WHEN `bi`.`status` = 'cancelled' THEN 1 ELSE 0 END) = COUNT(*) THEN 'cancelled'
    WHEN SUM(CASE WHEN `bi`.`status` = 'returned' THEN 1 ELSE 0 END) = COUNT(*) THEN 'returned'
    WHEN SUM(CASE WHEN `bi`.`status` = 'overdue' THEN 1 ELSE 0 END) > 0 THEN 'overdue'
    WHEN SUM(CASE WHEN `bi`.`status` NOT IN ('cancelled', 'returned') THEN 1 ELSE 0 END) = 0 THEN 'returned'
    WHEN SUM(CASE WHEN `bi`.`status` = 'returned' THEN 1 ELSE 0 END) > 0 THEN 'partially_returned'
    WHEN SUM(CASE WHEN `bi`.`status` = 'active' THEN 1 ELSE 0 END) > 0 THEN 'active'
    ELSE 'booked'
  END
  FROM `booking_item` `bi`
  WHERE `bi`.`booking_id` = `booking`.`id`
)
WHERE EXISTS (
  SELECT 1 FROM `booking_item` `bi2` WHERE `bi2`.`booking_id` = `booking`.`id`
);
