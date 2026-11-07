import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConsumptionsController } from './consumptions.controller';
import { ConsumptionsService } from './consumptions.service';

@Module({
  imports: [AuthModule],
  controllers: [ConsumptionsController],
  providers: [ConsumptionsService],
  exports: [ConsumptionsService],
})
export class ConsumptionsModule {}
