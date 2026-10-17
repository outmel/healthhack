// DeepSeek calls (OpenAI-compatible API): plate estimate (vision) and helper-note translation.
import OpenAI from "openai";
import { z } from "zod";

const MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-flash";
// Created on first use so `next build` works without the key set.
let client: OpenAI | undefined;
const getClient = () => (client ??= new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" }));

const Box = z.tuple([z.coerce.number(), z.coerce.number(), z.coerce.number(), z.coerce.number()]);
const PlateEstimate = z.object({
  percent_eaten: z.coerce.number().min(0).max(100),
  confidence: z.enum(["low", "medium", "high"]),
  note: z.string(),
  // Food left on the AFTER photo, boxes as [x, y, w, h] in 0-1 image coordinates.
  leftovers: z
    .array(z.object({ label: z.string(), box: Box }))
    .catch([]) // missing or malformed boxes -> none, never a failed estimate
    .transform((xs) =>
      xs
        .map((l) => ({ label: l.label.trim().toLowerCase(), box: clampBox(l.box) }))
        .filter((l) => l.label && l.box[2] > 0.02 && l.box[3] > 0.02)
        .slice(0, 6),
    ),
});

/** Keep boxes inside the photo; a box that spills off the edge is trimmed, not trusted blindly. */
function clampBox([x, y, w, h]: [number, number, number, number]): [number, number, number, number] {
  const c = (v: number) => Math.min(1, Math.max(0, v));
  const x0 = c(x), y0 = c(y);
  return [x0, y0, c(x + w) - x0, c(y + h) - y0];
}
export type PlateEstimate = z.infer<typeof PlateEstimate>;

const Translation = z.object({
  english: z.string(),
  concerns: z.array(z.string()).default([]),
});
export type Translation = z.infer<typeof Translation>;

type Img = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

/** JSON mode only guarantees valid JSON, so the shape is checked with zod. */
async function chatJson<T>(schema: z.ZodType<T>, messages: OpenAI.ChatCompletionMessageParam[]): Promise<T> {
  const res = await getClient().chat.completions.create({
    model: MODEL,
    messages,
    response_format: { type: "json_object" },
    // Thinking off: these are quick perception/translation tasks and the demo needs speed.
    reasoning_effort: "none",
    max_tokens: 1000,
  });
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error(`Empty response (finish_reason: ${res.choices[0]?.finish_reason})`);
  return schema.parse(JSON.parse(text));
}

export async function estimatePlate(before: Img, after: Img): Promise<PlateEstimate> {
  const url = (i: Img) => `data:${i.mediaType};base64,${i.data}`;
  return chatJson(PlateEstimate, [
    {
      role: "system",
      content:
        'You estimate how much of a meal an elderly person ate from before/after photos. Reply with JSON only: {"percent_eaten": number 0-100, "confidence": "low" | "medium" | "high", "note": "one short sentence on what was left", "leftovers": [{"label": "rice", "box": [x, y, w, h]}]}. Boxes are on the AFTER photo, as fractions 0-1 of its width and height, x,y = top-left corner.',
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Photo 1: the plate BEFORE the meal." },
        { type: "image_url", image_url: { url: url(before) } },
        { type: "text", text: "Photo 2: the same plate AFTER the meal." },
        { type: "image_url", image_url: { url: url(after) } },
        {
          type: "text",
          text: "Estimate what percentage of the food (by volume) was eaten. Ignore garnish, bones and inedible items. If the photos don't show the same meal, say so in the note and use low confidence. In leftovers, draw one tight box around each food that was not eaten on the AFTER photo, labelled in one or two plain English words; use [] if the plate is clean or you are unsure where the food is.",
        },
      ],
    },
  ]);
}

export async function translateNote(text: string, lang: string): Promise<Translation> {
  return chatJson(Translation, [
    {
      role: "system",
      content:
        'You translate short notes written by a domestic helper about the elderly person she cares for in Singapore. Translate faithfully into plain English; keep the helper\'s meaning and don\'t add medical interpretation. Reply with JSON only: {"english": string, "concerns": string[]} where concerns lists health-relevant observations (e.g. "dizziness on standing"), or [] if none.',
    },
    { role: "user", content: `Language code: ${lang}\nNote: ${text}` },
  ]);
}
