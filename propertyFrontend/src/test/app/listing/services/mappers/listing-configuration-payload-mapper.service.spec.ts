import { ListingConfigurationPayloadMapperService } from 'src/app/listing/services/mappers/listing-configuration-payload-mapper.service';

describe('ListingConfigurationPayloadMapperService', () => {
  it('toListingConfiguration should normalize configured payload values', () => {
    // Arrange
    const mapper = new ListingConfigurationPayloadMapperService();
    const payload = {
      staticMedia: ' http://cdn.example.com/media ',
      backend: { baseUrl: ' http://localhost:8081/ ' },
      google: { maps: { 'api-key': ' api-key ', 'map-id': ' map-id ' } }
    };

    // Action
    const result = mapper.toListingConfiguration(payload);

    // Assert
    expect(result).toEqual({
      backendBaseUrl: 'http://localhost:8081',
      staticMediaBaseUrl: 'http://cdn.example.com/media/',
      googleMapsApiKey: 'api-key',
      googleMapsMapId: 'map-id'
    });
  });

  it('toListingConfiguration should return defaults for nullish or empty payload values', () => {
    // Arrange
    const mapper = new ListingConfigurationPayloadMapperService();

    // Action
    const emptyResult = mapper.toListingConfiguration({
      staticMedia: '   ',
      backend: { baseUrl: '   ' },
      google: { maps: { 'api-key': '   ', 'map-id': 10 as unknown as string } }
    });
    const nullResult = mapper.toListingConfiguration(null);

    // Assert
    expect(emptyResult).toEqual({
      backendBaseUrl: 'http://192.168.1.110:4200',
      staticMediaBaseUrl: 'http://localhost:666/',
      googleMapsApiKey: null,
      googleMapsMapId: null
    });
    expect(nullResult).toEqual(emptyResult);
  });
});
