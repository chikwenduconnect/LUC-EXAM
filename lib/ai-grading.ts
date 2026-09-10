/**
 * AI-Assisted Written Answer Grading Service
 * Uses Google Gemini to evaluate student essay/written responses against admin-defined rubrics.
 */

export interface GradingRequest {
  questionText: string;
  rubric: string;
  modelAnswer?: string | null;
  maxPoints: number;
  studentAnswer: string;
}

export interface RubricCriterionScore {
  criteria: string;
  awarded: number;
  max: number;
  remarks: string;
}

export interface GradingResult {
  pointsAwarded: number;
  maxPoints: number;
  feedback: string;
  criteriaScores: RubricCriterionScore[];
  evaluatedBy: string;
  error?: string;
}

/**
 * Evaluates a written student answer using Google Gemini AI against the provided rubric.
 */
export async function evaluateWrittenAnswer(request: GradingRequest): Promise<GradingResult> {
  const { questionText, rubric, modelAnswer, maxPoints, studentAnswer } = request;

  // Handle empty or near-empty answers
  if (!studentAnswer || studentAnswer.trim().length === 0) {
    return {
      pointsAwarded: 0,
      maxPoints,
      feedback: "No response submitted by candidate.",
      criteriaScores: [
        {
          criteria: "Submission",
          awarded: 0,
          max: maxPoints,
          remarks: "Question was left blank.",
        },
      ],
      evaluatedBy: "AI_AUTOMATED",
    };
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY is not configured. Falling back to pending manual review.");
    return {
      pointsAwarded: 0,
      maxPoints,
      feedback: "AI Grading skipped: GEMINI_API_KEY is not configured in .env.local. Awaiting manual grading.",
      criteriaScores: [],
      evaluatedBy: "PENDING_MANUAL",
      error: "MISSING_API_KEY",
    };
  }

  const prompt = `You are a fair, thorough, and objective academic examination marker.
You have been tasked with grading a student's written response to an exam question based strictly on the administrator's grading rubric.

--- EXAM QUESTION ---
${questionText}

--- MAXIMUM SCORE ---
${maxPoints} points

--- GRADING RUBRIC / MARKING CRITERIA ---
${rubric || "Grade for conceptual accuracy, clarity, and completeness."}

${modelAnswer ? `--- REFERENCE / MODEL ANSWER (FOR COMPARISON) ---\n${modelAnswer}\n` : ""}

--- STUDENT'S WRITTEN RESPONSE ---
${studentAnswer}

--- EVALUATION INSTRUCTIONS ---
1. Score the student's answer according to the grading rubric.
2. The total score awarded MUST be a number between 0 and ${maxPoints} (inclusive). Half-points (e.g. 7.5) are permitted.
3. Be fair and objective: award marks where the student demonstrated correct knowledge matching the criteria. Deduct marks for inaccuracies, omissions, or irrelevant content as guided by the rubric.
4. Provide constructive, student-friendly feedback explaining specifically why points were awarded or deducted.
5. Provide a breakdown for each criterion identified in the rubric.

You MUST reply with ONLY a valid JSON object in the exact schema below, without any markdown code fences, backticks, or extra text:
{
  "pointsAwarded": number,
  "feedback": "string explaining overall reasoning and areas of strength/improvement",
  "criteriaScores": [
    {
      "criteria": "string name of criterion/concept",
      "awarded": number,
      "max": number,
      "remarks": "short justification"
    }
  ]
}`;

  try {
    // Call Gemini API via Google's REST endpoint (works reliably across environments)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent, deterministic grading
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini API error:", res.status, errText);
      throw new Error(`Gemini API returned status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error("Empty response from Gemini API");
    }

    // Clean any accidental markdown codeblock wrapper
    const cleanedJson = candidateText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanedJson);

    // Validate points awarded
    let awarded = Number(parsed.pointsAwarded);
    if (isNaN(awarded)) awarded = 0;
    awarded = Math.max(0, Math.min(maxPoints, Math.round(awarded * 10) / 10));

    return {
      pointsAwarded: awarded,
      maxPoints,
      feedback: parsed.feedback || "Evaluated by AI based on the examination rubric.",
      criteriaScores: Array.isArray(parsed.criteriaScores) ? parsed.criteriaScores : [],
      evaluatedBy: "GEMINI_AI",
    };
  } catch (err: any) {
    console.error("AI Grading failed:", err);
    return {
      pointsAwarded: 0,
      maxPoints,
      feedback: `AI evaluation encountered an issue: ${err.message}. Awaiting instructor review.`,
      criteriaScores: [],
      evaluatedBy: "ERROR_MANUAL_REVIEW",
      error: err.message,
    };
  }
}
