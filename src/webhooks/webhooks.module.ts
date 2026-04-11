import { Module } from '@nestjs/common';
import { WebhookController } from './webhooks.controller';
import { TransactionsModule } from '../transactions/transactions.module';
import { AccountsModule } from '../accounts/accounts.module';
import {
  FlutterwaveService,
  PaystackService,
  WebhookService,
} from './webhooks.service';

@Module({
  imports: [TransactionsModule, AccountsModule],
  controllers: [WebhookController],
  providers: [WebhookService, PaystackService, FlutterwaveService],
})
export class WebhooksModule {}
