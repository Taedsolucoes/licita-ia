import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
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
    logout(req: any): Promise<{
        message: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<void>;
    getMe(req: any): Promise<{
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
}
