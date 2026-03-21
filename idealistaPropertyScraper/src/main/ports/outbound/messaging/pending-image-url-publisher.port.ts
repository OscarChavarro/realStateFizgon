export type PendingImageUrlMessage = {
  url: string;
  propertyId: string;
};

export interface PendingImageUrlPublisherPort {
  publishPendingImageUrl(message: PendingImageUrlMessage): Promise<void>;
}
