import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ServiceDeskController } from './service-desk.controller';
import { ServiceDeskService } from './service-desk.service';

@Module({
  imports: [AuthModule],
  controllers: [ServiceDeskController],
  providers: [ServiceDeskService],
})
export class ServiceDeskModule {}
