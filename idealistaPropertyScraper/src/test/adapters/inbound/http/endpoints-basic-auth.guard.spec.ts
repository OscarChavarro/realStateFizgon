import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { EndpointsBasicAuthGuard } from 'src/adapters/inbound/http/endpoints-basic-auth.guard';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';
import { HttpExecutionContextMock } from '../../../support/mocks/http-execution-context.mock';
import { ScraperConfigMock } from '../../../support/mocks/scraper-config.mock';

function basicAuthHeader(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
}

describe('EndpointsBasicAuthGuard', () => {
  it.each([
    { authorization: undefined },
    { authorization: 'Bearer token' },
    { authorization: 'Basic bm9fY29sb24=' },
    { authorization: basicAuthHeader('invalid', 'password') },
    { authorization: basicAuthHeader('user', 'invalid') }
  ])('whenAuthorizationIsInvalid_canActivate_shouldThrowUnauthorized', ({ authorization }) => {
    // Arrange
    const config = new ScraperConfigMock({ endpointsUser: 'user', endpointsPassword: 'password' });
    const guard = new EndpointsBasicAuthGuard(config as unknown as ScraperConfig);
    const contextBuilder = new HttpExecutionContextMock({
      headers: authorization ? { authorization } : {}
    });
    // Action
    const action = () => guard.canActivate(contextBuilder.toExecutionContext());
    // Assert
    expect(action).toThrow(UnauthorizedException);
    expect(contextBuilder.response.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Basic realm="idealistaPropertyScraper"'
    );
  });

  it('whenAuthorizationIsValid_canActivate_shouldAllowRequest', () => {
    // Arrange
    const config = new ScraperConfigMock({ endpointsUser: 'user', endpointsPassword: 'password' });
    const guard = new EndpointsBasicAuthGuard(config as unknown as ScraperConfig);
    const contextBuilder = new HttpExecutionContextMock({
      headers: { authorization: basicAuthHeader('user', 'password') }
    });
    // Action
    const result = guard.canActivate(contextBuilder.toExecutionContext());
    // Assert
    expect(result).toBe(true);
    expect(contextBuilder.response.setHeader).not.toHaveBeenCalled();
  });

  it('whenBasicPayloadIsEmpty_canActivate_shouldRejectWithInvalidPayloadMessage', () => {
    // Arrange
    const config = new ScraperConfigMock({ endpointsUser: 'user', endpointsPassword: 'password' });
    const guard = new EndpointsBasicAuthGuard(config as unknown as ScraperConfig);
    const contextBuilder = new HttpExecutionContextMock({
      headers: { authorization: 'Basic ' }
    });
    // Action
    const action = () => guard.canActivate(contextBuilder.toExecutionContext());
    // Assert
    expect(action).toThrow('Invalid Basic auth payload.');
    expect(contextBuilder.response.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Basic realm="idealistaPropertyScraper"'
    );
  });

  it('whenBase64DecodingThrows_canActivate_shouldRejectWithInvalidPayloadMessage', () => {
    // Arrange
    const config = new ScraperConfigMock({ endpointsUser: 'user', endpointsPassword: 'password' });
    const guard = new EndpointsBasicAuthGuard(config as unknown as ScraperConfig);
    const bufferSpy = jest.spyOn(Buffer, 'from').mockImplementation(() => {
      throw new Error('decode error');
    });
    const contextBuilder = new HttpExecutionContextMock({
      headers: { authorization: 'Basic abc' }
    });
    // Action
    const action = () => guard.canActivate(contextBuilder.toExecutionContext());
    // Assert
    expect(action).toThrow('Invalid Basic auth payload.');
    bufferSpy.mockRestore();
  });
});
