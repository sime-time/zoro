import OpenAI from "openai";
import env from "../env";

export interface AudioInput {
  url: string;
  mimeType: string;
}

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function transcribeAudio(audio: AudioInput[]) {
  const audioTranscripts: string[] = [];

  for (const audioFile of audio) {
    console.log("[audio] Transcribing:", audioFile.url);
    try {
      const response = await fetch(audioFile.url);
      if (!response.ok) {
        console.error(
          `[audio] Fetch failed: ${response.status} ${response.statusText}`,
        );
        return { success: false, transcripts: [] };
      }

      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("Content-Type") || "audio/mp4";
      console.log(
        `[audio] File fetched: ${Math.round(arrayBuffer.byteLength / 1024)}KB, type: ${contentType}`,
      );

      // Create a file-like object for the Whisper API
      const blob = new Blob([arrayBuffer], { type: contentType });
      const file = new File([blob], "voice_memo.m4a", { type: contentType });

      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
      });

      const transcript = transcription.text.trim();
      if (transcript) {
        audioTranscripts.push(transcript);
      }
    } catch (err) {
      console.error("[audio] Transcription error:", err);
      return { success: false, transcripts: [] };
    }
  }

  return { success: true, transcripts: audioTranscripts };
}
