import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List active plans' })
  listPlans() {
    return this.billing.listPlans();
  }

  @Get('subscription')
  @ApiBearerAuth()
  @RequirePermissions('billing.manage')
  @ApiOperation({ summary: 'Current tenant subscription + usage' })
  getSubscription(@TenantId() tenantId: string) {
    return this.billing.getSubscription(tenantId);
  }

  @Get('usage')
  @ApiBearerAuth()
  @RequirePermissions('billing.manage')
  @ApiOperation({ summary: 'Current period usage records for tenant' })
  getUsage(@TenantId() tenantId: string) {
    return this.billing.getUsage(tenantId);
  }

  @Post('plan-change')
  @ApiBearerAuth()
  @RequirePermissions('billing.manage')
  @ApiOperation({ summary: 'Request plan upgrade/downgrade with payment proof' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['planName', 'paymentProof'],
      properties: {
        planName: {
          type: 'string',
          enum: ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'],
        },
        paymentProof: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('paymentProof', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  requestPlanChange(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { planName: string },
    @UploadedFile()
    paymentProof: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    return this.billing.requestPlanChange(
      tenantId,
      user.sub,
      body.planName,
      paymentProof,
    );
  }

  @Get('invoice')
  @ApiBearerAuth()
  @RequirePermissions('billing.manage')
  @ApiOperation({ summary: 'HTML invoice for current billing period' })
  getInvoice(@TenantId() tenantId: string) {
    return this.billing.getInvoiceHtml(tenantId);
  }

  @Get('invoices')
  @ApiBearerAuth()
  @RequirePermissions('billing.manage')
  @ApiOperation({
    summary: 'Invoice history from payment proofs + subscription periods',
  })
  listInvoices(@TenantId() tenantId: string) {
    return this.billing.listInvoices(tenantId);
  }
}
