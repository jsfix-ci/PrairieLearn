CREATE FUNCTION
    group_info_roles_validate (
        arg_assessment_id bigint,
        arg_user_id bigint
    ) RETURNS TABLE (
        role_name text,
        minimum integer,
        maximum integer,
        num_assigned integer
    )
AS $$
DECLARE
    arg_group_id bigint;
    arg_role_count integer;
    arg_role_update JSONB;
    arg_group_role_id bigint;
    minimum integer;
    maximum integer;
    role_name text;
    id bigint;
BEGIN
    -- Find group id
    SELECT g.id
    INTO arg_group_id
    FROM groups AS g
    JOIN group_configs AS gc ON g.group_config_id = gc.id
    WHERE 
        gc.assessment_id = arg_assessment_id
        AND g.deleted_at IS NULL
        AND gc.deleted_at IS NULL;

    -- Create table for number of each role
    CREATE TEMPORARY TABLE role_counts (
        role_id bigint,
        role_count integer
    ) ON COMMIT DROP; 

    -- Populate role counts with number of assignments of each role
    FOR arg_group_role_id IN
        SELECT gu.group_role_id
        FROM group_users gu
        WHERE gu.group_id = arg_group_id
    LOOP
        IF EXISTS (SELECT * FROM role_counts WHERE role_id = arg_group_role_id) THEN
            UPDATE role_counts
            SET role_count = role_count + 1
            WHERE role_id = arg_group_role_id;
        ELSE
            INSERT INTO role_counts (role_id, role_count)
            VALUES (arg_group_role_id, 1);
        END IF;
    END LOOP;

    CREATE TEMPORARY TABLE group_validation_errors (
        role_name text,
        minimum integer,
        maximum integer,
        num_assigned integer
    ) ON COMMIT DROP;

    -- Check if any roles exceed the max or fall below the min
    FOR maximum, minimum, id, role_name IN
        SELECT gr.maximum, gr.minimum, gr.id, gr.role_name
        FROM group_roles gr
        WHERE gr.assessment_id = arg_assessment_id
    LOOP
        -- Get role count for role
        SELECT rc.role_count INTO arg_role_count
        FROM role_counts rc
        WHERE rc.role_id = id;
        
        -- If role is missing from counts, there are no assignments
        IF arg_role_count IS NULL THEN
            arg_role_count := 0;
        END IF;

        -- Check if role count is in bounds
        IF arg_role_count > maximum OR arg_role_count < minimum THEN
            INSERT INTO group_validation_errors (role_name, minimum, maximum, num_assigned)
            VALUES (role_name, minimum, maximum, arg_role_count);
        END IF;
    END LOOP;

    RETURN QUERY (SELECT * FROM group_validation_errors);
END;
$$ LANGUAGE plpgsql VOLATILE;
