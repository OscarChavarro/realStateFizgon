import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthUsersController } from 'src/adapters/inbound/http/auth-users.controller';
import { Configuration } from 'src/infrastructure/config/configuration';
import { FixDatabaseController } from 'src/adapters/inbound/http/fix-database.controller';
import { GoogleAuthController } from 'src/adapters/inbound/http/google-auth.controller';
import { AuthUserIdentityService } from 'src/application/services/auth/auth-user-identity.service';
import { AuthSessionService } from 'src/application/services/auth/auth-session.service';
import { PropertiesController } from 'src/adapters/inbound/http/properties.controller';
import { RemoveDanglingImagesController } from 'src/adapters/inbound/http/remove-dangling-images.controller';
import { PropertiesUpdatesGateway } from 'src/adapters/inbound/websocket/properties-updates.gateway';
import { GoogleOAuthBootstrapService } from 'src/application/services/auth/google/google-oauth-bootstrap.service';
import { DanglingImagesCleanupService } from 'src/application/services/datamaintenance/dangling-images-cleanup.service';
import { FileSystemOperationsService } from 'src/adapters/outbound/filesystem/file-system-operations.service';
import { PriceFixer } from 'src/application/services/datamaintenance/price-fixer.service';
import { PropertyImagesDatabaseCleanupService } from 'src/application/services/datamaintenance/property-images-database-cleanup.service';
import { AuthUserRepository } from 'src/adapters/outbound/persistence/mongodb/auth-user.repository';
import { MongoDatabaseService } from 'src/adapters/outbound/persistence/mongodb/mongo-database.service';
import { MongoRepository } from 'src/adapters/outbound/persistence/mongodb/mongo.repository';
import { PropertiesMonitorService } from 'src/application/services/properties-monitor.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    })
  ],
  controllers: [
    PropertiesController,
    FixDatabaseController,
    RemoveDanglingImagesController,
    GoogleAuthController,
    AuthUsersController
  ],
  providers: [
    Configuration,
    AuthSessionService,
    AuthUserIdentityService,
    GoogleOAuthBootstrapService,
    AuthUserRepository,
    MongoDatabaseService,
    MongoRepository,
    PriceFixer,
    FileSystemOperationsService,
    PropertyImagesDatabaseCleanupService,
    DanglingImagesCleanupService,
    PropertiesUpdatesGateway,
    PropertiesMonitorService
  ]
})
export class AppModule {}
