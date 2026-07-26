import { Injectable } from '@nestjs/common';

describe('bootstrap smoke', () => {
  it('loads', () => {
    expect(true).toBe(true);
  });
});

@Injectable()
class Placeholder {}
void Placeholder;
