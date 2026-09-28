import { db } from "../config/database";
import { complaints } from "../db/schema";
import { isNotNull, ne } from "drizzle-orm";

export interface SimilarComplaintMatch {
  id: string;
  ticketNumber: string;
  title: string;
  location: string;
  status: string;
  similarity: number;
}

export class SimilarityService {
  /**
   * Cosine similarity between two float vectors
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
    const len = Math.min(vecA.length, vecB.length);

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find existing complaints that are semantically similar to the provided embedding vector
   */
  static async findSimilarComplaints(
    embedding: number[],
    excludeComplaintId?: string,
    threshold: number = 0.75,
    limit: number = 3
  ): Promise<SimilarComplaintMatch[]> {
    if (!embedding || embedding.length === 0) return [];

    try {
      // Query complaints that have an embedding stored
      const candidates = await db
        .select({
          id: complaints.id,
          ticketNumber: complaints.ticketNumber,
          title: complaints.title,
          location: complaints.location,
          status: complaints.status,
          embedding: complaints.embedding,
        })
        .from(complaints)
        .where(
          excludeComplaintId
            ? ne(complaints.id, excludeComplaintId)
            : isNotNull(complaints.embedding)
        );

      const matches: SimilarComplaintMatch[] = [];

      for (const row of candidates) {
        if (!row.embedding || !Array.isArray(row.embedding)) continue;

        const score = this.cosineSimilarity(embedding, row.embedding);
        if (score >= threshold) {
          matches.push({
            id: row.id,
            ticketNumber: row.ticketNumber,
            title: row.title,
            location: row.location,
            status: row.status,
            similarity: parseFloat(score.toFixed(4)),
          });
        }
      }

      // Sort by highest similarity
      matches.sort((a, b) => b.similarity - a.similarity);
      return matches.slice(0, limit);
    } catch (err) {
      console.error("Error finding similar complaints:", err);
      return [];
    }
  }
}
