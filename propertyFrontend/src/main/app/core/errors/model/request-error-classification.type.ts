export type RequestErrorCategory =
  | 'transient'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'validation'
  | 'server'
  | 'unknown';

export type RequestErrorClassification = {
  category: RequestErrorCategory;
  status: number | null;
  message: string;
};
