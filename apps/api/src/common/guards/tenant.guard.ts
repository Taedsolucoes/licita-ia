import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

const TAED_ROLES = ['taed_admin', 'taed_operator'];

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No user found in request');
    }

    // TAED roles can access all tenants
    if (TAED_ROLES.includes(user.role)) {
      return true;
    }

    // For tenant-scoped routes, check that the tenant_id in the route matches the user's tenant
    const paramTenantId = request.params?.tenantId;
    if (paramTenantId && paramTenantId !== user.tenantId) {
      throw new ForbiddenException('Access denied to this tenant');
    }

    return true;
  }
}
