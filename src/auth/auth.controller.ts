import { 
  Controller, 
  Get, 
  Post, 
  Req, 
  UseGuards, 
  Body, 
  HttpCode, 
  HttpStatus,
  BadRequestException,
  UnauthorizedException
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    try {
      const user = await this.authService.register(
        registerDto.username,
        registerDto.email,
        registerDto.password,
        registerDto.name,
      );
      
      return {
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt,
          },
        },
      };
    } catch (error) {
      if (error.message.includes('already exists')) {
        throw new BadRequestException({
          success: false,
          message: 'Registration failed',
          error: error.message,
        });
      }
      throw error;
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    try {
      const user = await this.authService.validateUser(loginDto.username, loginDto.password);
      const result = await this.authService.login(user);
      
      return {
        success: true,
        message: 'Login successful',
        data: result,
      };
    } catch (error) {
      throw new UnauthorizedException({
        success: false,
        message: 'Login failed',
        error: 'Invalid username or password',
      });
    }
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  getProfile(@Req() req) {
    return {
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: req.user,
      },
    };
  }
}


