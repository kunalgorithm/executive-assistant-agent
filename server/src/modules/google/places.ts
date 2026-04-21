import { env } from '@/utils/env';
import { logger } from '@/utils/log';

const PLACES_API_BASE = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.nationalPhoneNumber',
  'places.reservable',
  'places.currentOpeningHours.openNow',
].join(',');

const PRICE_LEVEL_LABEL: Record<string, string> = {
  PRICE_LEVEL_FREE: 'free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

export type Restaurant = {
  name: string;
  address: string;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: string | null;
  openNow: boolean | null;
  hours: string[] | null;
  phone: string | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  reservable: boolean | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePlace(place: any): Restaurant {
  return {
    name: place.displayName?.text ?? '(unknown)',
    address: place.formattedAddress ?? null,
    rating: place.rating ?? null,
    ratingCount: place.userRatingCount ?? null,
    priceLevel: place.priceLevel ? (PRICE_LEVEL_LABEL[place.priceLevel] ?? null) : null,
    openNow: place.currentOpeningHours?.openNow ?? null,
    hours: place.regularOpeningHours?.weekdayDescriptions ?? null,
    phone: place.nationalPhoneNumber ?? null,
    websiteUrl: place.websiteUri ?? null,
    googleMapsUrl: place.googleMapsUri ?? null,
    reservable: place.reservable ?? null,
  };
}

export type SearchRestaurantsArgs = {
  query: string;
  maxResults?: number;
};

const MAX_RESTAURANT_RESULTS = 5;

export async function searchRestaurants(args: SearchRestaurantsArgs) {
  if (!env.GOOGLE_MAPS_API_KEY) {
    return { ok: false as const, error: 'api_key_not_configured' };
  }

  try {
    const response = await fetch(PLACES_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: args.query,
        maxResultCount: Math.min(args.maxResults ?? MAX_RESTAURANT_RESULTS, MAX_RESTAURANT_RESULTS),
        includedType: 'restaurant',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('[places] searchRestaurants API error', { status: response.status, body: text });
      return { ok: false as const, error: 'api_error' };
    }

    const data = (await response.json()) as { places?: unknown[] };
    const restaurants: Restaurant[] = (data.places ?? []).map(normalizePlace);
    return { ok: true as const, restaurants };
  } catch (error) {
    logger.error('[places] searchRestaurants failed', {
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false as const, error: 'api_error' };
  }
}
