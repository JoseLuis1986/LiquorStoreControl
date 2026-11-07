import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalesController } from './sales.controller';

@Module({
  imports: [AuthModule],
  controllers: [SalesController],
})
export class SalesModule {}
