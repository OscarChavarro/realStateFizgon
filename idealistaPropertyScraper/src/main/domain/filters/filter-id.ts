export const FILTER_IDS = {
  PROPERTY_TYPE: 'propertyType',
  PRICE: 'price',
  RENTAL_TYPE: 'rentalType',
  SIZE: 'size',
  HOUSING_TYPE: 'housingType',
  OTHER_DENOMINATIONS: 'otherDenominations',
  EQUIPMENT: 'equipment',
  ROOMS: 'rooms',
  BATHROOMS: 'bathrooms',
  CONDITION: 'condition',
  FEATURES: 'features',
  FLOOR: 'floor',
  ENERGY_EFFICIENCY: 'energyEfficiency',
  MULTIMEDIA: 'multimedia',
  LISTING_TYPE: 'listingType',
  PUBLICATION_DATE: 'publicationDate'
} as const;

export type FilterId = (typeof FILTER_IDS)[keyof typeof FILTER_IDS];
