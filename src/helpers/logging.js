import { captureException } from "@sentry/react";

export function logError(error) {
  console.error(error);
  if (process.env.REACT_APP_LOGGING === "true") {
    captureException(error);
  }
}
