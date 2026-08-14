type BlooioErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  } | null;
};

function formatFallbackError(text: string): string {
  if (!text) return "No response body";
  if (text.includes("<!DOCTYPE") || text.includes("<html>")) {
    return "[HTML error page]";
  }
  return text.length > 300 ? text.slice(0, 300) : text;
}

export async function throwBlooioError(response: Response) {
  const errorText = await response.text();

  try {
    const body = JSON.parse(errorText) as BlooioErrorBody;
    const error = body.error;

    if (error?.code || error?.message) {
      const errorDetails = error.details
        ? ` details=${JSON.stringify(error.details)}`
        : "";
      const errorCode = error.code ?? "";
      const errorMessage = `Blooio API error ${response.status} ${errorCode}: ${error.message ?? "Unknown error"}${errorDetails}`;

      console.error(`[blooio] ${errorMessage}`);
      throw new Error(errorMessage);
    }
  } catch (err) {
    if (!(err instanceof SyntaxError)) {
      throw err;
    }
  }

  const fallback = formatFallbackError(errorText);
  console.error(`[blooio] API error ${response.status}: ${fallback}`);
  throw new Error(`Blooio API error ${response.status}: ${fallback}`);
}
