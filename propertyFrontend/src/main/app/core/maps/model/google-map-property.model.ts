export type GoogleMapPropertyReview = 'NEW' | 'FAVOURITE' | 'DISCHARGED';

export type GoogleMapProperty = {
  id: string;
  propertyId: string;
  title: string;
  price: string;
  latitude: number;
  longitude: number;
  closed?: boolean;
  review: GoogleMapPropertyReview;
  imageUrls: string[];
};
