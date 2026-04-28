import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    private configService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService);
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            tenantId: string;
            role: string;
            fullName: string;
            email: string;
            isActive: true;
        };
    }>;
    refresh(dto: RefreshTokenDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    logout(userId: string): Promise<{
        message: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<void>;
    getMe(userId: string): Promise<{
        id: string;
        tenantId: string;
        role: string;
        fullName: string;
        email: string;
        phone: string | null;
        isActive: boolean;
        tenant: {
            id: string;
            corporateName: string;
            tradeName: string;
            cnpj: string;
            status: string;
        };
    }>;
    private generateTokens;
    private hashToken;
    private parseDuration;
}
