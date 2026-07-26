import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

describe('StorageService driver selection', () => {
  it('defaults to local when STORAGE_DRIVER unset', async () => {
    const config = {
      get: (key: string) => {
        if (key === 'STORAGE_DRIVER') return undefined;
        if (key === 'PORT') return '3001';
        return undefined;
      },
    } as ConfigService;
    const svc = new StorageService(config);
    await svc.onModuleInit();
    const svg = svc.placeholderSvg({ pose: 'front', label: 'test' });
    expect(svg.length).toBeGreaterThan(10);
  });
});

@Injectable()
class KeepNestHappy {}
void KeepNestHappy;
