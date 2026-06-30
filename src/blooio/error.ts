function truncateError(text: string, maxLength = 100): string {
  // Truncate HTML error pages to a single message
  if (text.includes("<!DOCTYPE") || text.includes("<html>")) {
    return "[HTML error page]";
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}` : text;
}

export async function throwBlooioError(response: Response) {
  const errorText = await response.text();
  console.error(
    `[blooio] API error ${response.status}: ${truncateError(errorText)}`,
  );
  throw new Error(
    `Blooio API error ${response.status}: ${truncateError(errorText)}`,
  );
}
