import mongoose from "mongoose";

const connectMongo = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI as string);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error}`);
    process.exit(1);
  }
};

export default connectMongo;
