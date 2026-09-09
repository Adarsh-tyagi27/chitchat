import { AuthService } from './auth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

export class AuthController {
  static register = asyncHandler(async (req, res) => {
    const { email, password, fullName } = req.body;
    const user = await AuthService.register(email, password, fullName);
    res.status(201).json(new ApiResponse(201, 'User registered successfully', user));
  });

  static login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    res.status(200).json(new ApiResponse(200, 'Login successful', result));
  });

  static refresh = asyncHandler(async (req, res) => {
    const { refreshToken, userId } = req.body;
    const tokens = await AuthService.refreshAccessToken(refreshToken, userId);
    res.status(200).json(new ApiResponse(200, 'Token refreshed', tokens));
  });

  static logout = asyncHandler(async (req, res) => {
    const { refreshToken, userId } = req.body;
    await AuthService.logout(refreshToken, userId);
    res.status(200).json(new ApiResponse(200, 'Logged out successfully'));
  });
}
