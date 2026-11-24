ALTER TABLE showcase.execution_comments
    ADD COLUMN parent_comment_id UUID,
    ADD CONSTRAINT execution_comments_id_execution_unique UNIQUE (comment_id, execution_id),
    ADD CONSTRAINT execution_comments_parent_execution_fk
        FOREIGN KEY (parent_comment_id, execution_id)
        REFERENCES showcase.execution_comments (comment_id, execution_id),
    ADD CONSTRAINT execution_comments_not_own_parent CHECK (parent_comment_id IS DISTINCT FROM comment_id);

CREATE INDEX execution_comments_parent_idx
    ON showcase.execution_comments (execution_id, parent_comment_id, created_at, comment_id);
