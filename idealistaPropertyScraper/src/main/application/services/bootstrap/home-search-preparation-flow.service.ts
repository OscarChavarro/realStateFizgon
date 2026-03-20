import { Injectable } from '@nestjs/common';
import { PrepareHomeSearchUseCase } from 'src/application/usecases/bootstrap/prepare-home-search.use-case';

@Injectable()
export class HomeSearchPreparationFlowService {
  constructor(private readonly prepareHomeSearchUseCase: PrepareHomeSearchUseCase) {}

  async execute(host: string, port: number): Promise<void> {
    await this.prepareHomeSearchUseCase.execute(host, port);
  }
}
