/** Research service facade: collections, builders, synthesis artifacts. */

import type { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import type { DataLayout } from '../env.ts'
import type { ArtifactStore } from '../services/artifact-store.ts'
import type { PaperCollection } from '../../shared/contracts.ts'
import type { AcademicProvider } from './provider-http.ts'
import { CollectionBuilder, CollectionStore } from './collection-builder.ts'
import { OpenAlexProvider } from './providers/openalex.ts'
import { SemanticScholarProvider } from './providers/semanticscholar.ts'
import { synthesize } from './synthesis.ts'

export class ResearchService {
  readonly store: CollectionStore
  readonly builder: CollectionBuilder

  private readonly layout: DataLayout
  private readonly artifacts: ArtifactStore

  constructor(
    db: DatabaseSync,
    layout: DataLayout,
    artifacts: ArtifactStore,
    extraProviders: AcademicProvider[] = [],
  ) {
    this.layout = layout
    this.artifacts = artifacts
    this.store = new CollectionStore(db)
    const cacheRoot = join(layout.cacheDir, 'academic')
    const providers = [
      new OpenAlexProvider({ cacheDir: join(cacheRoot, 'openalex') }),
      new SemanticScholarProvider({ cacheDir: join(cacheRoot, 's2') }),
      ...extraProviders,
    ]
    this.builder = new CollectionBuilder(this.store, providers)
  }

  latest(input: { topic: string; count?: number; since?: string }): Promise<PaperCollection> {
    return this.builder.build({
      topic: input.topic,
      count: input.count,
      since: input.since,
      poolFactor: 3,
    })
  }

  get(collectionId: string): PaperCollection | undefined {
    return this.store.get(collectionId)
  }

  list() {
    return this.store.list()
  }

  /** Deterministic cited synthesis → Markdown artifact bound to nothing external. */
  synthesizeToArtifact(collectionId: string): { artifactId: string; warnings: string[]; claimCount?: number } {
    const collection = this.store.get(collectionId)
    if (!collection) throw new Error(`collection not found: ${collectionId}`)
    const result = synthesize(collection)
    const ref = this.artifacts.put({
      kind: 'research-report',
      mediaType: 'text/markdown',
      bytes: result.markdown,
      sourceRefs: [
        {
          id: `collection-${collectionId}`,
          kind: 'url',
          ref: `grad://collections/${collectionId}`,
          title: `Paper collection "${collection.topic}"`,
          createdAt: collection.createdAt,
        },
      ],
    })
    return { artifactId: ref.id, warnings: result.warnings, ...(result.claims.length ? { claimCount: result.claims.length } : {}) }
  }
}
