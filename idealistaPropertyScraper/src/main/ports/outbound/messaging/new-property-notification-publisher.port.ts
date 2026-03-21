export type NewPropertyNotificationMessage = {
  url: string;
  title: string | null;
};

export interface NewPropertyNotificationPublisherPort {
  publishNewPropertyNotification(message: NewPropertyNotificationMessage): Promise<void>;
}
