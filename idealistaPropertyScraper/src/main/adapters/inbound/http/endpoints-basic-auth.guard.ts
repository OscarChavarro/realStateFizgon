import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { ScraperConfig } from 'src/infrastructure/config/settings/scraper.config';

@Injectable()
export class EndpointsBasicAuthGuard implements CanActivate {
  constructor(private readonly scraperConfig: ScraperConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, unknown> }>();
    const response = context.switchToHttp().getResponse<{ setHeader: (name: string, value: string) => void }>();
    const authorization = request?.headers?.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Basic ')) {
      this.setAuthChallengeHeader(response);
      throw new UnauthorizedException('Missing or invalid Basic auth header.');
    }

    const encodedCredentials = authorization.slice('Basic '.length).trim();
    const decodedCredentials = this.decodeBase64(encodedCredentials);
    if (!decodedCredentials) {
      this.setAuthChallengeHeader(response);
      throw new UnauthorizedException('Invalid Basic auth payload.');
    }

    const separatorIndex = decodedCredentials.indexOf(':');
    if (separatorIndex <= 0) {
      this.setAuthChallengeHeader(response);
      throw new UnauthorizedException('Invalid Basic auth credentials format.');
    }

    const providedUser = decodedCredentials.slice(0, separatorIndex);
    const providedPassword = decodedCredentials.slice(separatorIndex + 1);

    const expectedUser = this.scraperConfig.endpointsUser;
    const expectedPassword = this.scraperConfig.endpointsPassword;
    const userMatches = this.constantTimeEquals(providedUser, expectedUser);
    const passwordMatches = this.constantTimeEquals(providedPassword, expectedPassword);

    if (!userMatches || !passwordMatches) {
      this.setAuthChallengeHeader(response);
      throw new UnauthorizedException('Invalid endpoint credentials.');
    }

    return true;
  }

  private decodeBase64(payload: string): string | undefined {
    try {
      return Buffer.from(payload, 'base64').toString('utf8');
    } catch {
      return undefined;
    }
  }

  private constantTimeEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private setAuthChallengeHeader(response: { setHeader: (name: string, value: string) => void }): void {
    response.setHeader('WWW-Authenticate', 'Basic realm="idealistaPropertyScraper"');
  }
}
