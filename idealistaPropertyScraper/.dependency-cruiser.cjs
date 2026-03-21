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
        'Application modules must not import concrete adapters or infrastructure modules directly.',
      from: {
        path: '^src/main/application/(usecases|services)/.*\\.module\\.ts$'
      },
      to: {
        path: '^src/main/(adapters|infrastructure)/'
      }
    },
    {
      name: 'domain-must-not-depend-on-application-adapters-or-infrastructure',
      severity: 'error',
      from: {
        path: '^src/main/domain/'
      },
      to: {
        path: '^src/main/(application|adapters|infrastructure|ports)/'
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
    },
    {
      name: 'application-dto-must-not-depend-on-non-dto-layers',
      severity: 'error',
      comment:
        'Application DTO contracts must stay transport-only and not depend on domain/adapters/infrastructure/ports.',
      from: {
        path: '^src/main/application/dto/'
      },
      to: {
        path: '^(src/main/(adapters|domain|infrastructure|ports)/|src/main/application/(?!dto/))'
      }
    },
    {
      name: 'outbound-adapters-must-not-depend-on-application',
      severity: 'error',
      comment:
        'Outbound adapters should implement ports and avoid taking dependencies on application services/use cases.',
      from: {
        path: '^src/main/adapters/outbound/'
      },
      to: {
        path: '^src/main/application/'
      }
    },
    {
      name: 'infrastructure-must-not-depend-on-application-or-adapters',
      severity: 'error',
      comment:
        'Infrastructure building blocks should remain technical and independent from application/adapters.',
      from: {
        path: '^src/main/infrastructure/'
      },
      to: {
        path: '^src/main/(application|adapters)/'
      }
    },
    {
      name: 'only-composition-root-can-import-inbound-adapters',
      severity: 'error',
      comment:
        'Inbound adapters should only be referenced by themselves or the application composition root.',
      from: {
        path: '^src/main/',
        pathNot: '(^src/main/adapters/inbound/|^src/main/app\\.module\\.ts$)'
      },
      to: {
        path: '^src/main/adapters/inbound/'
      }
    },
    {
      name: 'inbound-controllers-must-not-depend-on-application',
      severity: 'error',
      comment:
        'Inbound controllers must talk to inbound ports/contracts, not concrete application classes.',
      from: {
        path: '^src/main/adapters/inbound/.*\\.controller\\.ts$'
      },
      to: {
        path: '^src/main/application/'
      }
    },
    {
      name: 'inbound-non-modules-must-not-depend-on-application',
      severity: 'error',
      comment:
        'Only inbound wiring modules can reference application implementations for DI composition.',
      from: {
        path: '^src/main/adapters/inbound/',
        pathNot: '\\.module\\.ts$'
      },
      to: {
        path: '^src/main/application/'
      }
    },
    {
      name: 'inbound-ports-must-not-depend-on-application-adapters-or-infrastructure',
      severity: 'error',
      comment:
        'Inbound port contracts must stay framework-agnostic and independent from application/adapters/infrastructure.',
      from: {
        path: '^src/main/ports/inbound/'
      },
      to: {
        path: '^src/main/(application|adapters|infrastructure)/'
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
