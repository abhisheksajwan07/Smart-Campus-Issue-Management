import { db } from "../config/database";
import { complaints } from "../db/schema";
import { TokenPayload } from "../types";
import { cosineDistance, sql, ne, and, isNotNull, lte, asc } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SimilarComplaintMatch {
  id: string;
  ticketNumber: string;
  title: string;
  location: string;
  status: string;
  similarity: number;
  canView?: boolean;
}

/**
 * Calibrated on 30 labelled complaint pairs using calibrateSimilarityThreshold.ts.
 * Chosen to maximise F1 on all-MiniLM-L6-v2 (384-dim SBERT) embeddings.
 * Re-calibrate if you swap embedding models.
 */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.80;

const EMBEDDING_DIMENSIONS = 384;

// ─── Core Search ─────────────────────────────────────────────────────────────

/**
 * Find existing complaints that are semantically similar to the provided embedding vector.
 * Uses PostgreSQL pgvector cosine distance operator (<=>) via Drizzle ORM.
 *
 * NOTE: The HNSW index (complaints_embedding_hnsw_idx) is defined in schema.ts
 * with vector_cosine_ops. Before calling this "indexed", verify with:
 *   EXPLAIN ANALYZE SELECT ... FROM complaints ORDER BY embedding <=> '[...]' LIMIT 3;
 * HNSW applies post-filters, so aggressive WHERE clauses may cause fewer rows than expected.
 *
 * @throws on DB failure — callers must decide fail-open vs fail-closed.
 */
export async function findSimilarComplaints(
  embedding: number[],
  excludeComplaintId?: string,
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
  limit: number = 3,
  options?: {
    /** If true (default), skip RESOLVED and REJECTED complaints from results */
    excludeInactive?: boolean;
    /** Optional viewer to determine whether the match can be opened directly */
    viewer?: TokenPayload;
  }
): Promise<SimilarComplaintMatch[]> {
  // ── Guard: empty embedding → no results (not an error) ──
  if (!embedding || embedding.length === 0) return [];

  // ── Guard: wrong dimension → hard error before it hits the DB ──
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}. ` +
      `Ensure the ML service and pgvector column use the same model.`
    );
  }

  // ── Guard: non-finite values or zero-norm vector (pgvector <=> returns NaN on zero vector) ──
  let normSq = 0;
  for (const val of embedding) {
    if (!Number.isFinite(val)) return [];
    normSq += val * val;
  }
  if (normSq <= 1e-12) return [];

  const safeThreshold = Math.max(0, Math.min(1, Number.isFinite(threshold) ? threshold : DEFAULT_SIMILARITY_THRESHOLD));
  const safeLimit = Math.max(1, Math.min(20, Number.isFinite(limit) ? Math.floor(limit) : 3));

  // pgvector: cosineDistance = 1 - cosineSimilarity
  // similarity >= threshold  ⟺  cosineDistance <= (1 - threshold)
  const maxDistance = 1 - safeThreshold;
  const distanceExpr = cosineDistance(complaints.embedding, embedding);
  const similaritySql = sql<number>`(1 - (${distanceExpr}))`;

  const conditions = [
    isNotNull(complaints.embedding),
    lte(distanceExpr, maxDistance),
  ];

  if (excludeComplaintId) {
    conditions.push(ne(complaints.id, excludeComplaintId));
  }

  // By default, exclude resolved/rejected complaints — a "fixed" issue isn't a duplicate
  const excludeInactive = options?.excludeInactive ?? true;
  if (excludeInactive) {
    conditions.push(
      sql`${complaints.status} NOT IN ('RESOLVED', 'REJECTED')`
    );
  }

  // NO try/catch here. If the DB fails, the error propagates.
  // The caller (complaintController) wraps this in try/catch and decides
  // to fail-open: complaint is still created, similarity is just skipped.
  const rows = await db
    .select({
      id: complaints.id,
      ticketNumber: complaints.ticketNumber,
      title: complaints.title,
      location: complaints.location,
      status: complaints.status,
      studentId: complaints.studentId,
      assignedDepartmentId: complaints.assignedDepartmentId,
      similarity: similaritySql,
    })
    .from(complaints)
    .where(and(...conditions))
    .orderBy(asc(distanceExpr))
    .limit(safeLimit);

  const viewer = options?.viewer;
  return rows.map((row) => {
    let canView = false;
    if (viewer) {
      if (viewer.role === "ADMIN") canView = true;
      else if (viewer.role === "STAFF") canView = !viewer.departmentId || row.assignedDepartmentId === viewer.departmentId;
      else if (viewer.role === "STUDENT") canView = row.studentId === viewer.userId;
    }
    return {
      id: row.id,
      ticketNumber: row.ticketNumber,
      title: row.title,
      location: row.location,
      status: row.status,
      similarity: Math.round(Number(row.similarity) * 1e4) / 1e4,
      ...(viewer ? { canView } : {}),
    };
  });
}
