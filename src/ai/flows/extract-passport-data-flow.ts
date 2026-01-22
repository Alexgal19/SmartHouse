'use server';
/**
 * @fileOverview A flow for extracting passport data using OCR.
 *
 * - extractPassportData - A function that handles the passport data extraction process.
 * - ExtractPassportDataInput - The input type for the extractPassportData function.
 * - ExtractPassportDataOutput - The return type for the extractPassportData function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractPassportDataInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a passport, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractPassportDataInput = z.infer<typeof ExtractPassportDataInputSchema>;

const ExtractPassportDataOutputSchema = z.object({
  firstName: z.string().describe('The given names of the person. If not found, return "-".'),
  lastName: z.string().describe('The surname or family name of the person. If not found, return "-".'),
});
export type ExtractPassportDataOutput = z.infer<typeof ExtractPassportDataOutputSchema>;

export async function extractPassportData(input: ExtractPassportDataInput): Promise<ExtractPassportDataOutput> {
  return extractPassportDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractPassportDataPrompt',
  input: { schema: ExtractPassportDataInputSchema },
  output: { schema: ExtractPassportDataOutputSchema },
  prompt: `You are an expert OCR system specialized in reading identity documents.

Analyze the provided passport image and extract the person's given names and surname.
- The "Given Names" should be mapped to the "firstName" field.
- The "Surname" or "Family Name" should be mapped to the "lastName" field.

IMPORTANT: If a "Given Names" or "Surname" field is not present in the document, you MUST return a single hyphen "-" for the corresponding field. Do not leave it empty or write "N/A".

Image to process: {{media url=photoDataUri}}`,
});

const extractPassportDataFlow = ai.defineFlow(
  {
    name: 'extractPassportDataFlow',
    inputSchema: ExtractPassportDataInputSchema,
    outputSchema: ExtractPassportDataOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
