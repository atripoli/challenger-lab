const express = require('express');

const { pool } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/stats/dashboard
router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const [
      statusCounts,
      uplift,
      winningCategories,
      platformPreds,
      recent,
      pipelineDuration,
    ] = await Promise.all([
      pool.query(
        `SELECT status, COUNT(*)::int AS n
           FROM experiments
          WHERE deleted_at IS NULL
          GROUP BY status`,
      ),
      pool.query(
        `SELECT
            COUNT(*)::int                                                            AS n,
            AVG(uplift_vs_champion)::numeric(5,2)                                    AS avg,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY uplift_vs_champion)::numeric(5,2) AS median,
            MAX(uplift_vs_champion)::numeric(5,2)                                    AS max,
            MIN(uplift_vs_champion)::numeric(5,2)                                    AS min
           FROM experiments
          WHERE status = 'completed'
            AND uplift_vs_champion IS NOT NULL
            AND deleted_at IS NULL`,
      ),
      pool.query(
        `SELECT a->>'category' AS category,
                COUNT(*)::int  AS wins
           FROM experiments e,
                jsonb_array_elements(e.angles) a
          WHERE e.status = 'completed'
            AND e.deleted_at IS NULL
            AND e.winner_id IS NOT NULL
            AND CONCAT('angle_', a->>'angle_number') = e.winner_id
          GROUP BY a->>'category'
          ORDER BY wins DESC`,
      ),
      pool.query(
        `SELECT pp.key                                  AS platform,
                AVG((pp.value)::numeric)::numeric(4,2)  AS avg_score,
                COUNT(*)::int                           AS n
           FROM experiments e,
                jsonb_array_elements(e.scores) s,
                jsonb_each_text(s->'platform_prediction') pp
          WHERE e.status = 'completed'
            AND e.deleted_at IS NULL
            AND s->'platform_prediction' IS NOT NULL
          GROUP BY pp.key
          ORDER BY avg_score DESC`,
      ),
      pool.query(
        `SELECT e.id, e.name, e.winner_id, e.uplift_vs_champion, e.completed_at,
                p.name AS product_name, c.name AS client_name,
                e.winner_payload->>'recommendation' AS recommendation
           FROM experiments e
           JOIN products p ON p.id = e.product_id
           JOIN clients  c ON c.id = p.client_id
          WHERE e.status = 'completed' AND e.deleted_at IS NULL
          ORDER BY e.completed_at DESC
          LIMIT 5`,
      ),
      pool.query(
        `SELECT
           AVG(EXTRACT(EPOCH FROM (completed_at - created_at)))::int AS avg_seconds,
           COUNT(*)::int                                              AS n
           FROM experiments
          WHERE status = 'completed'
            AND completed_at IS NOT NULL
            AND deleted_at IS NULL`,
      ),
    ]);

    // Totales por status
    const totals = {
      experiments: 0, completed: 0, failed: 0, draft: 0,
      analyzing: 0, awaiting_review: 0, optimizing: 0, executing: 0, scoring: 0,
    };
    for (const row of statusCounts.rows) {
      totals[row.status] = row.n;
      totals.experiments += row.n;
    }

    // Categorías ganadoras con share
    const totalWins = winningCategories.rows.reduce((s, r) => s + r.wins, 0);
    const winning_categories = winningCategories.rows.map((r) => ({
      category: r.category,
      wins:     r.wins,
      share:    totalWins > 0 ? Number((r.wins / totalWins).toFixed(2)) : 0,
    }));

    res.json({
      totals,
      uplift: {
        n:      uplift.rows[0].n,
        avg:    Number(uplift.rows[0].avg),
        median: Number(uplift.rows[0].median),
        max:    Number(uplift.rows[0].max),
        min:    Number(uplift.rows[0].min),
      },
      winning_categories,
      platform_predictions: platformPreds.rows.map((r) => ({
        platform:  r.platform,
        avg_score: Number(r.avg_score),
        n:         r.n,
      })),
      recent_completed: recent.rows,
      pipeline_duration: {
        avg_seconds: pipelineDuration.rows[0].avg_seconds,
        n:           pipelineDuration.rows[0].n,
      },
    });
  }),
);

module.exports = router;
