/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: {
        circular: true
      }
    },
    {
      name: 'application-usecases-services-must-not-import-adapters-or-infrastructure',
      severity: 'error',
      comment:
        'Use cases and application services should rely on domain/application/ports abstractions, not concrete adapters/infrastructure.',
      from: {
        path: '^src/main/application/(usecases|services)/',
        pathNot: '\\.module\\.ts$'
      },
      to: {
        path: '^src/main/(adapters|infrastructure)/'
      }
    },
    {
      name: 'application-modules-should-not-import-infrastructure-directly',
      severity: 'error',
      comment:
        'Application modules must not import infrastructure modules directly.',
      from: {
        path: '^src/main/application/(usecases|services)/.*\\.module\\.ts$'
      },
      to: {
        path: '^src/main/infrastructure/'
      }
    },
    {
      name: 'domain-must-not-depend-on-application-adapters-or-infrastructure',
      severity: 'error',
      from: {
        path: '^src/main/domain/'
      },
      to: {
        path: '^src/main/(application|adapters|infrastructure)/'
      }
    },
    {
      name: 'ports-must-not-depend-on-adapters-or-infrastructure',
      severity: 'error',
      from: {
        path: '^src/main/ports/'
      },
      to: {
        path: '^src/main/(adapters|infrastructure)/'
      }
    },
    {
      name: 'ports-must-not-depend-on-application-except-dtos',
      severity: 'error',
      comment:
        'Ports can depend on shared DTO contracts in application/dto, but not on application services/use cases.',
      from: {
        path: '^src/main/ports/'
      },
      to: {
        path: '^src/main/application/',
        pathNot: '^src/main/application/dto/'
      }
    }
  ],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: {
      path: 'node_modules'
    },
    includeOnly: '^src/main',
    tsConfig: {
      fileName: 'tsconfig.json'
    }
  }
};
