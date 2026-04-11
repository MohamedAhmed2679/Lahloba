import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// In production, use: import { MeiliSearch } from 'meilisearch';
// For now, stub interface that mirrors the real SDK

export interface MeiliDoc { id: string; [key: string]: any; }
interface SearchResult<T> { hits: T[]; estimatedTotalHits: number; processingTimeMs: number; query: string; }

@Injectable()
export class MeilisearchService implements OnModuleInit {
  private readonly logger = new Logger(MeilisearchService.name);
  private documents: Map<string, MeiliDoc[]> = new Map();

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.logger.log('Meilisearch service initialized (stub mode)');
    // In production: connect to MeiliSearch instance
    // this.client = new MeiliSearch({ host: this.config.get('MEILI_URL'), apiKey: this.config.get('MEILI_KEY') });
    await this.createIndexes();
  }

  private async createIndexes() {
    for (const idx of ['meals', 'chefs', 'ingredients', 'stores']) {
      this.documents.set(idx, []);
    }
    this.logger.log('Search indexes created: meals, chefs, ingredients, stores');
  }

  async indexDocument(index: string, doc: MeiliDoc) {
    const docs = this.documents.get(index) || [];
    const existing = docs.findIndex(d => d.id === doc.id);
    if (existing >= 0) docs[existing] = doc;
    else docs.push(doc);
    this.documents.set(index, docs);
  }

  async indexDocuments(index: string, docs: MeiliDoc[]) {
    for (const doc of docs) await this.indexDocument(index, doc);
  }

  async deleteDocument(index: string, id: string) {
    const docs = this.documents.get(index) || [];
    this.documents.set(index, docs.filter(d => d.id !== id));
  }

  async search<T = MeiliDoc>(index: string, query: string, options?: {
    filter?: string; sort?: string[]; limit?: number; offset?: number;
    facets?: string[]; attributesToHighlight?: string[];
  }): Promise<SearchResult<T>> {
    const docs = this.documents.get(index) || [];
    const q = query.toLowerCase();
    const hits = docs.filter(d => {
      return Object.values(d).some(v =>
        typeof v === 'string' && v.toLowerCase().includes(q)
      );
    }).slice(options?.offset || 0, (options?.offset || 0) + (options?.limit || 20));

    return {
      hits: hits as T[],
      estimatedTotalHits: hits.length,
      processingTimeMs: 1,
      query,
    };
  }

  async multiSearch(queries: { indexUid: string; q: string; limit?: number }[]) {
    const results = await Promise.all(
      queries.map(q => this.search(q.indexUid, q.q, { limit: q.limit }))
    );
    return { results };
  }
}
