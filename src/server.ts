import dotenv from "dotenv";

dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import connectMongo from "./config/connectMongo";
import prisma from "./config/prisma";
import { initSocket } from "./config/socket";
import { errorHandler } from "./middlewares";
import authRouter from "./modules/auth/auth.route";
import userRouter from "./modules/user/user.route";
import sellerRouter from "./modules/seller/seller.route";
import sellerKycRouter from "./modules/sellerkyc/kyc.route";
import sellerCategoryRouter from "./modules/sellercategory/sellercategory.route";
import propertyRouter from "./modules/property/property.route";
import "./workers/email.worker";





const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;



initSocket(server);



app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/sellers", sellerRouter);
app.use("/api/v1/sellers/kyc", sellerKycRouter);
app.use("/api/v1/seller-categories", sellerCategoryRouter);
app.use("/api/v1/properties", propertyRouter);

app.get("/", (req, res) => {
  res.json({ message: "Real Estate API is running" });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("PostgreSQL Connected via Prisma");

    await connectMongo();
    console.log("MongoDB Connected via Mongoose");

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export default app;
