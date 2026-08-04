import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { UpdateUserInput } from "./user.validation";

const userSelect = {
  id: true,
  email: true,
  phone: true,
  phoneVerified: true,
  userType: true,
  platformStaff: {
    select: {
      role: true,
      department: true,
      designation: true,
    },
  },
  status: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...userSelect,
      person: {
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          displayName: true,
          gender: true,
          avatar: true,
          city: true,
          state: true,
          country: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};

const updateProfile = async (userId: string, data: UpdateUserInput) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: userSelect,
  });

  return user;
};

const getAllUsers = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: userSelect,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count(),
  ]);

  return {
    users,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};

const updateProfilePicture = async (userId: string, avatarUrl: string) => {
  const person = await prisma.person.update({
    where: { userId },
    data: { avatarUrl },
  });

  return person;
};

export { getProfile, updateProfile, updateProfilePicture, getAllUsers, getUserById, userSelect };
