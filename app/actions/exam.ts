"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addMultipleChoiceQuestion(
  examId: string,
  questionText: string,
  points: number,
  options: { text: string }[],
  correctOptionIndex: number
) {
  const supabase = createAdminClient();

  // 1. Get the current max order
  const { data: qData } = await supabase
    .from("questions")
    .select("question_order")
    .eq("exam_id", examId)
    .order("question_order", { ascending: false })
    .limit(1);
    
  const order = qData && qData.length > 0 ? qData[0].question_order + 1 : 1;

  // 2. Insert Question
  const { data: question, error: qError } = await supabase
    .from("questions")
    .insert([{ exam_id: examId, question_text: questionText, points, question_order: order, question_type: 'MULTIPLE_CHOICE' }])
    .select()
    .single();

  if (qError) throw new Error(qError.message);

  // 3. Insert Options
  const optionsToInsert = options.map((opt, idx) => ({
    question_id: question.id,
    option_text: opt.text,
    option_order: idx + 1
  }));

  const { data: insertedOptions, error: optError } = await supabase
    .from("options")
    .insert(optionsToInsert)
    .select();

  if (optError) throw new Error(optError.message);

  // 4. Insert Correct Answer securely
  const correctOptionId = insertedOptions[correctOptionIndex].id;
  
  const { error: ansError } = await supabase
    .from("correct_answers")
    .insert([{ question_id: question.id, correct_option_id: correctOptionId }]);

  if (ansError) throw new Error(ansError.message);

  revalidatePath(`/admin/exams/${examId}`);
  return { success: true };
}

export async function addWrittenQuestion(
  examId: string,
  questionText: string,
  points: number,
  rubric: string = "",
  modelAnswer: string = ""
) {
  const supabase = createAdminClient();

  const { data: qData } = await supabase
    .from("questions")
    .select("question_order")
    .eq("exam_id", examId)
    .order("question_order", { ascending: false })
    .limit(1);

  const order = qData && qData.length > 0 ? qData[0].question_order + 1 : 1;

  const { data: question, error: qError } = await supabase
    .from("questions")
    .insert([{
      exam_id: examId,
      question_text: questionText,
      points,
      question_order: order,
      question_type: 'WRITTEN'
    }])
    .select()
    .single();

  if (qError) throw new Error(qError.message);

  // Store rubric & model answer in correct_answers
  // Resilient handling: Try with rubric column; fallback to encoded model_answer if migration pending
  const { error: ansError } = await supabase
    .from("correct_answers")
    .insert([{
      question_id: question.id,
      model_answer: modelAnswer || null,
      rubric: rubric || null
    }]);

  if (ansError) {
    const encoded = JSON.stringify({
      rubric: rubric || "",
      modelAnswer: modelAnswer || ""
    });
    await supabase
      .from("correct_answers")
      .insert([{
        question_id: question.id,
        model_answer: encoded
      }]);
  }

  revalidatePath(`/admin/exams/${examId}`);
  return { success: true };
}

export async function updateExamStatus(examId: string, status: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("exams")
    .update({ status })
    .eq("id", examId);
    
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/exams/${examId}`);
  return { success: true };
}
