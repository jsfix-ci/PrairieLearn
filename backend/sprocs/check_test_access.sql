CREATE OR REPLACE FUNCTION
    check_test_access (
        IN test_id integer,
        IN mode enum_mode,
        IN role enum_role,
        IN uid varchar(255),
        IN date TIMESTAMP WITH TIME ZONE,
        OUT available boolean,
        OUT credit integer
        ) AS $$
WITH
access_rule_results AS (
    SELECT check_test_access_rule(tar, check_test_access.mode, check_test_access.role, check_test_access.uid, check_test_access.date)
    FROM test_access_rules AS tar
    WHERE tar.test_id = test_id
)
SELECT
*
--    COALESCE(bool_or(open), FALSE) AS open,
--    COALESCE(max(credit), 0) AS credit
FROM access_rule_results
--WHERE open
;
$$ LANGUAGE SQL;
