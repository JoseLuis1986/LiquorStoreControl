import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../common/types/auth-user';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        status: 'ACTIVE',
        ...(dto.tenantSlug
          ? { tenant: { slug: dto.tenantSlug } }
          : {}),
      },
      include: { tenant: true },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (user.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tenant inactivo');
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.typ !== 'refresh') {
        throw new UnauthorizedException('Refresh inválido');
      }
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, status: 'ACTIVE' },
        include: { tenant: true },
      });
      if (!user || user.tenant.status !== 'ACTIVE') {
        throw new UnauthorizedException('Usuario no válido');
      }
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Refresh inválido o expirado');
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { tenant: true },
    });
    return {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        customerId: user.customerId,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
    };
  }

  private issueTokens(user: {
    id: string;
    tenantId: string;
    email: string;
    fullName: string;
    role: JwtPayload['role'];
    customerId: string | null;
    tenant: { id: string; name: string; slug: string };
  }) {
    const base = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      customerId: user.customerId,
    };
    const accessToken = this.jwt.sign(
      { ...base, typ: 'access' satisfies JwtPayload['typ'] },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: (this.config.get<string>('JWT_EXPIRES_IN') ??
          '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );
    const refreshToken = this.jwt.sign(
      { ...base, typ: 'refresh' satisfies JwtPayload['typ'] },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ??
          '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        customerId: user.customerId,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
    };
  }
}
