import { Request } from "express";
import {
  UserStatus,
  AccountOrigin,
  MemberScope,
  MemberStatus,
} from "../generated/prisma/enums";

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  accountOrigin: AccountOrigin;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;

  person: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;

  memberships: {
    id: string;
    scope: MemberScope;
    contextId: string | null;
    status: MemberStatus;
    role: {
      id: string;
      roleName: string;
      isSystemRole: boolean;
    };
  }[];
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}
