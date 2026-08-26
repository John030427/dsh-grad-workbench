/**
 * Food Map — restaurant capture → (optional) place resolution → user-confirmed pin.
 *
 * Critical rule (PRD VS3): an ambiguous candidate is NEVER silently pinned.
 * Without a wired PlaceProvider everything lands as `unresolved` and stays
 * there until the user confirms a place or address. Map vendor integration is
 * deliberately separate from domain storage.
 */

import type { DatabaseSync } from 'node:sqlite'
import { errors } from '../../shared/errors.ts'

export interface PlaceCandidate {
  placeId: string
  name: string
  address?: string
  lat?: number
  lng?: number
}

/** Vendor-neutral place resolution seam (MapLibre rendering stays separate). */
export interface PlaceProvider {
  readonly id: string
  searchPlace(query: string, context: { city?: string }): Promise<PlaceCandidate[]>
}

export type RestaurantStatus = 'want_to_try' | 'visited' | 'favorite' | 'avoid' | 'unresolved'

export interface Restaurant {
  id: string
  name: string
  aliases: string[]
  address?: string
  lat?: number
  lng?: number
  city?: string
  sourceTexts: string[]
  tags: string[]
  cuisines: string[]
  status: RestaurantStatus
  ratingByUser?: number
  notes?: string
  firstSavedAt: string
  lastVisitedAt?: string
}

interface Row extends Record<string, unknown> {
  id: string
  name: string
  aliases: string
  address: string | null
  lat: number | null
  lng: number | null
  city: string | null
  source_texts: string
  tags: string
  cuisines: string
  status: string
  rating_by_user: number | null
  notes: string | null
  first_saved_at: string
  last_visited_at: string | null
}

export class FoodService {
  private readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
  }

  /**
   * Capture a restaurant from text/name. Location is resolved only through an
   * explicit user confirmation — captures stay `unresolved`.
   */
  save(input: { name: string; note?: string; cuisine?: string; sourceText?: string; city?: string }): Restaurant {
    if (!input.name || input.name.trim().length === 0) throw errors.invalidInput('restaurant name is required')
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO restaurants
           (id, name, aliases, source_texts, tags, cuisines, notes, city, status, first_saved_at)
         VALUES (?, ?, '[]', ?, '[]', ?, ?, ?, 'unresolved', ?)`,
      )
      .run(
        id,
        input.name.trim(),
        JSON.stringify(input.sourceText ? [input.sourceText.slice(0, 500)] : []),
        JSON.stringify(input.cuisine ? [input.cuisine] : []),
        input.note ?? null,
        input.city ?? null,
        now,
      )
    return this.get(id)
  }

  /** Confirm WHERE the place is — a user decision, never automatic. */
  confirm(
    id: string,
    place: { address?: string; lat?: number; lng?: number; city?: string } = {},
  ): Restaurant {
    const current = this.get(id)
    if (!place.address && place.lat === undefined && place.lng === undefined) {
      throw errors.invalidInput('confirm requires an address or coordinates from the user')
    }
    this.db
      .prepare(
        `UPDATE restaurants SET status = 'want_to_try', address = COALESCE(?, address), lat = COALESCE(?, lat),
           lng = COALESCE(?, lng), city = COALESCE(?, city) WHERE id = ?`,
      )
      .run(place.address ?? null, place.lat ?? null, place.lng ?? null, place.city ?? null, current.id)
    return this.get(id)
  }

  setStatus(id: string, status: Exclude<RestaurantStatus, 'unresolved'>, rating?: number): Restaurant {
    this.get(id)
    const visitedAt = status === 'visited' || status === 'favorite' ? new Date().toISOString() : null
    this.db
      .prepare(
        `UPDATE restaurants SET status = ?,
           rating_by_user = COALESCE(?, rating_by_user),
           last_visited_at = COALESCE(?, last_visited_at)
         WHERE id = ?`,
      )
      .run(status, rating ?? null, visitedAt, id)
    return this.get(id)
  }

  get(id: string): Restaurant {
    const row = this.db.prepare('SELECT * FROM restaurants WHERE id = ? AND deleted_at IS NULL').get(id) as
      | Row
      | undefined
    if (!row) throw errors.notFound('restaurant', id)
    return this.rowToRestaurant(row)
  }

  list(filter: { status?: RestaurantStatus; query?: string; limit?: number } = {}): Restaurant[] {
    const clauses = ['deleted_at IS NULL']
    const params: Array<string | number> = []
    if (filter.status) {
      clauses.push('status = ?')
      params.push(filter.status)
    }
    if (filter.query) {
      clauses.push('(name LIKE ? OR tags LIKE ? OR cuisines LIKE ?)')
      const like = `%${filter.query}%`
      params.push(like, like, like)
    }
    params.push(filter.limit ?? 100)
    const rows = this.db
      .prepare(`SELECT * FROM restaurants WHERE ${clauses.join(' AND ')} ORDER BY first_saved_at DESC LIMIT ?`)
      .all(...params) as unknown as Row[]
    return rows.map((r) => this.rowToRestaurant(r))
  }

  delete(id: string): void {
    this.get(id)
    this.db.prepare('UPDATE restaurants SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id)
  }

  private rowToRestaurant(row: Row): Restaurant {
    return {
      id: row.id,
      name: row.name,
      aliases: JSON.parse(row.aliases),
      address: row.address ?? undefined,
      lat: row.lat ?? undefined,
      lng: row.lng ?? undefined,
      city: row.city ?? undefined,
      sourceTexts: JSON.parse(row.source_texts),
      tags: JSON.parse(row.tags),
      cuisines: JSON.parse(row.cuisines),
      status: row.status as RestaurantStatus,
      ratingByUser: row.rating_by_user ?? undefined,
      notes: row.notes ?? undefined,
      firstSavedAt: row.first_saved_at,
      lastVisitedAt: row.last_visited_at ?? undefined,
    }
  }
}
