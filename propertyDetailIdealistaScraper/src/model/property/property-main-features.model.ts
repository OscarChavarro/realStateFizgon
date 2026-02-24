export class PropertyMainFeatures {
  constructor(
    public readonly area: string | null,
    public readonly bedrooms: string | null,
    public readonly buildingLocation: string | null,
    public readonly additionalNotes: string[]
  ) {}
}
