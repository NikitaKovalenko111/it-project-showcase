UPDATE showcase.student_curators sc
SET revoked_at = CURRENT_TIMESTAMP
WHERE sc.revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM showcase.user_roles ur
    JOIN showcase.roles r ON r.role_id = ur.role_id
    WHERE ur.user_id = sc.curator_id AND r.code = 'university_staff'
  );

DELETE FROM showcase.user_roles ur
USING showcase.roles r
WHERE ur.role_id = r.role_id AND r.code = 'mentor';

DELETE FROM showcase.roles WHERE code = 'mentor';

UPDATE showcase.roles SET name = 'Куратор' WHERE code = 'university_staff';
