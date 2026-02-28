import { Injectable } from '@nestjs/common';
import { CdpClient } from './filter-cdp-client.types';

@Injectable()
export class FilterActionExecutorService {
  async clickPlainOption(
    client: CdpClient,
    selector: string,
    option: string,
    mode: 'enable' | 'disable'
  ): Promise<boolean> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const normalize = (value) => (value || '')
          .normalize('NFD')
          .replace(/[\\u0300-\\u036f]/g, '')
          .replace(/\\s+/g, ' ')
          .replace(/Desplegar/gi, '')
          .trim()
          .toLowerCase();
        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return false;
        }

        const target = normalize(${JSON.stringify(option)});
        const labels = Array.from(root.querySelectorAll('label'));

        for (const label of labels) {
          const input = label.querySelector('input[type="checkbox"], input[type="radio"]');
          if (!input) {
            continue;
          }

          const content = label.querySelector('span > span');
          const labelText = normalize(content ? content.textContent : label.textContent);
          if (labelText !== target) {
            continue;
          }

          const isChecked = Boolean(input.checked);
          if (${JSON.stringify(mode)} === 'enable' && !isChecked) {
            label.click();
            return true;
          }
          if (${JSON.stringify(mode)} === 'disable' && isChecked && input.type === 'checkbox') {
            label.click();
            return true;
          }
          return false;
        }

        return false;
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    return result.result?.value === true;
  }

  async clickSingleSelectorDropdownOption(
    client: CdpClient,
    selector: string,
    option: string
  ): Promise<boolean> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const normalize = (value) => (value || '')
          .normalize('NFD')
          .replace(/[\\u0300-\\u036f]/g, '')
          .replace(/\\s+/g, ' ')
          .replace(/Desplegar/gi, '')
          .trim()
          .toLowerCase();

        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return false;
        }

        const target = normalize(${JSON.stringify(option)});

        const hiddenInput = root.querySelector('input[type="hidden"]');
        const hiddenValue = hiddenInput && typeof hiddenInput.value === 'string'
          ? hiddenInput.value.trim()
          : '';
        if (hiddenValue.length > 0) {
          const selectedNode = root.querySelector(
            'ul.dropdown-list > li[data-value="' + hiddenValue.replace(/"/g, '\\"') + '"], ul.dropdown > li[data-value="' + hiddenValue.replace(/"/g, '\\"') + '"]'
          );
          const selectedText = normalize(selectedNode ? selectedNode.textContent : '');
          if (selectedText === target) {
            return false;
          }
        }

        const selectedPlaceholder = normalize(
          root.querySelector('button.dropdown-wrapper > span.placeholder, :scope > button.dropdown-wrapper > span.placeholder')?.textContent || ''
        );
        if (selectedPlaceholder === target) {
          return false;
        }

        const button = root.querySelector('button.dropdown-wrapper');
        if (button) {
          button.click();
        }

        const options = Array.from(
          root.querySelectorAll('ul.dropdown-list > li, ul.dropdown > li')
        );

        for (const item of options) {
          const text = normalize(item.textContent);
          if (text !== target) {
            continue;
          }
          const clickable = item.querySelector('a') || item;
          clickable.click();
          return true;
        }

        return false;
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    return result.result?.value === true;
  }

  async clickMinMaxOption(
    client: CdpClient,
    selector: string,
    role: 'min' | 'max',
    value: string
  ): Promise<boolean> {
    const result = await client.Runtime.evaluate({
      expression: `(() => {
        const normalize = (text) => (text || '').replace(/\\s+/g, ' ').trim();
        const root = document.querySelector(${JSON.stringify(selector)});
        if (!root) {
          return false;
        }

        const dropdowns = Array.from(root.querySelectorAll(':scope > .dropdown-list'));
        const container = dropdowns[${role === 'min' ? 0 : 1}];
        if (!container) {
          return false;
        }

        const target = normalize(${JSON.stringify(value)});
        const current = normalize(
          container.querySelector('button.dropdown-wrapper > span.placeholder, .dropdown-wrapper > span.placeholder')?.textContent || ''
        );
        if (current === target) {
          return false;
        }

        const button = container.querySelector('button.dropdown-wrapper');
        if (button) {
          button.click();
        }

        const options = Array.from(
          container.querySelectorAll('ul.dropdown-list.dropdown-insertion > li, ul.dropdown > li, ul.dropdown-list > li')
        );

        for (const option of options) {
          const text = normalize(option.textContent);
          if (text !== target) {
            continue;
          }
          const clickable = option.querySelector('a') || option;
          clickable.click();
          return true;
        }

        return false;
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails?.text) {
      throw new Error(result.exceptionDetails.text);
    }

    return result.result?.value === true;
  }
}
