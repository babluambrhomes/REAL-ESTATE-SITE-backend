import prisma from "../config/prisma";

interface IpLocationResponse {
  success: boolean;
  message?: string;
  ip: string;
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
}

export const getLocationFromIP = async (userId: string, ipAddress?: string) => {
  if (!ipAddress || ipAddress === "127.0.0.1" || ipAddress === "::1" || ipAddress === "::ffff:127.0.0.1") return;

  try {
    const response = await fetch(`https://ipwho.is/${ipAddress}`);

    if (!response.ok) {
      throw new Error("Failed to fetch IP location");
    }

    const data = (await response.json()) as IpLocationResponse;

    if (!data.success) {
      throw new Error(data.message || "IP location not found");
    }

    if (data.latitude != null && data.longitude != null) {
      await prisma.person.update({
        where: { userId },
        data: { latitude: data.latitude, longitude: data.longitude },
      });
    }
  } catch {
    // Fire & forget — IP lookup fail ho toh kuch mat karo
  }
};