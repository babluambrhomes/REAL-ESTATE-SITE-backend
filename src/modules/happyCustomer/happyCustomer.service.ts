import prisma from "../../config/prisma";
import { buildPagination, getPaginationParams } from "../../helpers";
import { ApiError } from "../../utils";
import type {
  CreateHappyCustomerInput,
  HappyCustomerListQueryInput,
  UpdateHappyCustomerInput,
} from "./happyCustomer.validation";

const happyCustomerSelect = {
  id: true,
  name: true,
  message: true,
  rating: true,
  photoUrl: true,
  address: true,
  isActive: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
};

const platformHappyCustomerSelect = {
  ...happyCustomerSelect,
  userId: true,
};

const assertUserExists = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) throw new ApiError(400, "Invalid user");
};

const listPublicHappyCustomers = async (
  query: HappyCustomerListQueryInput
) => {
  const { skip, take, page, limit } = getPaginationParams(query);
  const where = { isActive: true };

  const [items, total] = await Promise.all([
    prisma.happyCustomer.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take,
      select: happyCustomerSelect,
    }),
    prisma.happyCustomer.count({ where }),
  ]);

  return {
    data: items,
    ...buildPagination(total, page, limit),
  };
};

const listHappyCustomers = async (query: HappyCustomerListQueryInput) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const [items, total] = await Promise.all([
    prisma.happyCustomer.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take,
      select: platformHappyCustomerSelect,
    }),
    prisma.happyCustomer.count(),
  ]);

  return {
    data: items,
    ...buildPagination(total, page, limit),
  };
};

const getHappyCustomerById = async (id: string) => {
  const item = await prisma.happyCustomer.findUnique({
    where: { id },
    select: platformHappyCustomerSelect,
  });

  if (!item) throw new ApiError(404, "Happy customer not found");

  return item;
};

const createHappyCustomer = async (data: CreateHappyCustomerInput) => {
  if (data.userId) await assertUserExists(data.userId);

  return prisma.happyCustomer.create({
    data,
    select: platformHappyCustomerSelect,
  });
};

const updateHappyCustomer = async (
  id: string,
  data: UpdateHappyCustomerInput
) => {
  await getHappyCustomerById(id);

  if (data.userId) await assertUserExists(data.userId);

  return prisma.happyCustomer.update({
    where: { id },
    data,
    select: platformHappyCustomerSelect,
  });
};

const deleteHappyCustomer = async (id: string) => {
  await getHappyCustomerById(id);

  await prisma.happyCustomer.delete({ where: { id } });

  return { message: "Happy customer deleted" };
};

export {
  listPublicHappyCustomers,
  listHappyCustomers,
  getHappyCustomerById,
  createHappyCustomer,
  updateHappyCustomer,
  deleteHappyCustomer,
};
