interface Config {
  port: number;
  nodeEnv: string;
  dbGatewayBaseUrl: string;
  cors: {
    allowedOrigins: string[];
  };
}

function validateConfig(): Config {
  return {
    port: Number.parseInt(process.env.PORT || "3000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    dbGatewayBaseUrl:
      process.env.DB_GATEWAY_BASE_URL || "http://localhost:3000",
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : ["http://localhost:3000", "http://localhost:8080", "null"],
    },
  };
}

export const config = validateConfig();
