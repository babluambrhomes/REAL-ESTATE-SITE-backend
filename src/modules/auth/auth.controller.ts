import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  VerifyOtpInput,
  ConfirmOtpInput,
  ForgotPasswordRequestInput,
  ResetPasswordInput,
  AddContactInput,
  UpdatePasswordInput,
} from "./auth.validation";
import * as authService from "./auth.service";
import { getAccessCookieOptions, getRefreshCookieOptions } from "../../helpers";

const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userAgent = req.headers["user-agent"];
  const ipAddress = req.ip;

  const result = await authService.register(req.body as RegisterInput, userAgent, ipAddress);

  const message = result.user.email
    ? "OTP sent to your email. Please verify to continue."
    : "OTP sent to your phone. Please verify to continue.";

  res.status(201).json(new ApiResponse(201, result, message));
});

const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userAgent = req.headers["user-agent"];
  const ipAddress = req.ip;

  const result = await authService.login(req.body as LoginInput, userAgent, ipAddress) as any;

  if (result.requiresOtp) {
    res.status(200).json(new ApiResponse(200, null, result.message));
    return;
  }

  res.cookie("accessToken", result.accessToken, getAccessCookieOptions());
  res.cookie("refreshToken", result.refreshToken, getRefreshCookieOptions());

  res.status(200).json(
    new ApiResponse(
      200,
      { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken },
      "Logged in successfully"
    )
  );
});

const publicOtpVerify = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.publicOtpVerify(req.body as VerifyOtpInput);
  res.status(200).json(new ApiResponse(200, null, result.message));
});

const privateOtpVerify = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userAgent = req.headers["user-agent"];
  const ipAddress = req.ip;

  const result = await authService.privateOtpVerify(req.user!.id, req.body as ConfirmOtpInput, userAgent, ipAddress) as any;

  if (result.accessToken && result.refreshToken) {
    res.cookie("accessToken", result.accessToken, getAccessCookieOptions());
    res.cookie("refreshToken", result.refreshToken, getRefreshCookieOptions());
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        user: result.user || null,
        accessToken: result.accessToken || null,
        refreshToken: result.refreshToken || null,
      },
      result.message
    )
  );
});

const refreshToken = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { refreshToken: token } = req.body as RefreshTokenInput;

  const { accessToken, refreshToken: newRefreshToken } =
    await authService.refreshAccessToken(token);

  res.cookie("accessToken", accessToken, getAccessCookieOptions());
  res.cookie("refreshToken", newRefreshToken, getRefreshCookieOptions());

  res.status(200).json(
    new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Token refreshed successfully")
  );
});

const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  await authService.logout(refreshToken);

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken", { path: "/api/v1/auth" });

  res.status(200).json(new ApiResponse(200, null, "Logged out successfully"));
});

const forgotPasswordRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.forgotPasswordRequest(req.body as ForgotPasswordRequestInput);
  res.status(200).json(new ApiResponse(200, null, result.message));
});

const resetPassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.resetPassword(req.body as ResetPasswordInput);
  res.status(200).json(new ApiResponse(200, null, result.message));
});

const addContact = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.addContact(req.user!.id, req.body as AddContactInput);
  res.status(200).json(new ApiResponse(200, null, result.message));
});

const updatePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.updatePassword(req.user!.id, req.body as UpdatePasswordInput);
  res.status(200).json(new ApiResponse(200, null, result.message));
});

export {
  register,
  login,
  publicOtpVerify,
  privateOtpVerify,
  addContact,
  updatePassword,
  refreshToken,
  logout,
  forgotPasswordRequest,
  resetPassword,
};
