import { Injectable } from '@nestjs/common';

type RuntimeWithEvaluate = {
  evaluate(params: { expression: string; returnByValue?: boolean; awaitPromise?: boolean }): Promise<{
    result?: { value?: unknown };
  }>;
};

@Injectable()
export class OriginErrorDetectorService {
  private static readonly TITLE_NEEDLES = [
    '425 unknown error',
    'unknown error'
  ] as const;

  private static readonly TEXT_NEEDLES = [
    'error 425 unknown error',
    'error 425',
    'unknown error',
    'error 54113',
    'varnish cache server'
  ] as const;

  buildConditionExpression(titleVariable: string, textVariable: string): string {
    const titleChecks = OriginErrorDetectorService.TITLE_NEEDLES
      .map((needle) => `${titleVariable}.includes(${JSON.stringify(needle)})`);
    const textChecks = OriginErrorDetectorService.TEXT_NEEDLES
      .map((needle) => `${textVariable}.includes(${JSON.stringify(needle)})`);

    return [...titleChecks, ...textChecks].join(' || ');
  }

  buildIifeExpression(): string {
    const condition = this.buildConditionExpression('title', 'text');
    return `(() => {
      const title = (document.title || '').toLowerCase();
      const text = (document.body?.innerText || '').toLowerCase();
      return ${condition};
    })()`;
  }

  async hasOriginError(runtime: RuntimeWithEvaluate): Promise<boolean> {
    const evaluation = await runtime.evaluate({
      expression: this.buildIifeExpression(),
      returnByValue: true
    });

    return evaluation.result?.value === true;
  }
}
