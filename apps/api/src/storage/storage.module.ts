import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { MediaController } from './media.controller';

@Global()
@Module({
  providers: [StorageService],
  controllers: [MediaController],
  exports: [StorageService],
})
export class StorageModule {}
