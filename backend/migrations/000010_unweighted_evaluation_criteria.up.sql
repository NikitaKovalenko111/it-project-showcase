ALTER TABLE showcase.evaluation_criteria DROP COLUMN weight;

ALTER TABLE showcase.evaluations
    ADD COLUMN max_score NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK(max_score >= 0);

UPDATE showcase.evaluations evaluation
SET total_score = COALESCE(summary.total_score,0),
    max_score = COALESCE(summary.max_score,0)
FROM (
    SELECT scores.evaluation_id,
           SUM(scores.score) AS total_score,
           SUM(criteria.max_score) AS max_score
    FROM showcase.criterion_scores scores
    JOIN showcase.evaluation_criteria criteria ON criteria.criterion_id=scores.criterion_id
    GROUP BY scores.evaluation_id
) summary
WHERE evaluation.evaluation_id=summary.evaluation_id;

ALTER TABLE showcase.evaluations
    ADD CONSTRAINT evaluations_score_range_check CHECK(total_score <= max_score);
