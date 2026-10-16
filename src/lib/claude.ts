// Claude calls: plate estimate (vision) and helper-note translation.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
const client = new Anthropic();

const PlateEstimate = z.object({
  percent_eaten: z.number().describe("0-100, share of the original food that is gone"),
  confidence: z.enum(["low", "medium", "high"]),
  note: z.string().describe("One short sentence describing what was left"),
});
export type PlateEstimate = z.infer<typeof PlateEstimate>;

type Img = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

export async function estimatePlate(before: Img, after: Img): Promise<PlateEstimate> {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(PlateEstimate) },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Photo 1: the plate BEFORE an elderly person ate." },
          { type: "image", source: { type: "base64", media_type: before.mediaType, data: before.data } },
          { type: "text", text: "Photo 2: the same plate AFTER the meal." },
          { type: "image", source: { type: "base64", media_type: after.mediaType, data: after.data } },
          {
            type: "text",
            text: "Estimate what percentage of the food (by volume) was eaten. Ignore garnish, bones and inedible items. If the photos don't show the same meal, say so in the note and use low confidence.",
          },
        ],
      },
    ],
  });
  if (!res.parsed_output) throw new Error(`Plate estimate failed (stop_reason: ${res.stop_reason})`);
  return res.parsed_output;
}

const Translation = z.object({
  english: z.string(),
  concerns: z.array(z.string()).describe("Health-relevant observations, e.g. 'dizziness on standing'. Empty if none."),
});
export type Translation = z.infer<typeof Translation>;

export async function translateNote(text: string, lang: string): Promise<Translation> {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(Translation) },
    system:
      "You translate short notes written by a domestic helper about the elderly person she cares for in Singapore. Translate faithfully into plain English; keep the helper's meaning and don't add medical interpretation.",
    messages: [{ role: "user", content: `Language code: ${lang}\nNote: ${text}` }],
  });
  if (!res.parsed_output) throw new Error(`Translation failed (stop_reason: ${res.stop_reason})`);
  return res.parsed_output;
}
