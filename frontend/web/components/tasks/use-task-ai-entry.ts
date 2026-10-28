'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { ApiError } from '../../lib/api';
import {
  confirmTaskDecomposition,
  previewTaskDecomposition,
  previewGeneratedTasks,
  type DecomposedTaskDraft,
  type GeneratedSubtaskDraft,
  type TaskGenerationPreview,
  type TaskDecompositionPreview,
} from '../../lib/tasks';

type AiEntryMode = 'generate' | 'decompose';

type SelectableGeneratedSubtask = GeneratedSubtaskDraft & {
  selected: boolean;
};

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

type TaskAiEntryOptions = {
  onClose: () => void;
  onGenerated: (preview: TaskGenerationPreview) => void;
  setSubmitError: Dispatch<SetStateAction<string | null>>;
};

export function useTaskAiEntry({ onClose, onGenerated, setSubmitError }: TaskAiEntryOptions) {
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [aiEntryMode, setAiEntryMode] = useState<AiEntryMode>('generate');
  const [parseFeedback, setParseFeedback] = useState<string | null>(null);
  const [generationPreview, setGenerationPreview] = useState<TaskGenerationPreview | null>(null);
  const [decompositionPreview, setDecompositionPreview] = useState<TaskDecompositionPreview | null>(
    null,
  );
  const [decomposedTask, setDecomposedTask] = useState<DecomposedTaskDraft | null>(null);
  const [decomposedSubtasks, setDecomposedSubtasks] = useState<SelectableGeneratedSubtask[]>([]);
  const [generationBusy, setGenerationBusy] = useState(false);

  function clearAiPreview() {
    setParseFeedback(null);
    setGenerationPreview(null);
    setDecompositionPreview(null);
    setDecomposedTask(null);
    setDecomposedSubtasks([]);
  }

  function selectAiEntryMode(mode: AiEntryMode) {
    setAiEntryMode(mode);
    clearAiPreview();
  }

  async function createFromNaturalLanguage() {
    if (!naturalLanguageInput.trim()) {
      setParseFeedback('Add a task description before generating details.');
      return;
    }
    setGenerationBusy(true);
    setParseFeedback(null);
    setSubmitError(null);
    try {
      if (aiEntryMode === 'decompose') {
        const preview = await previewTaskDecomposition(naturalLanguageInput.trim());
        setDecompositionPreview(preview);
        setDecomposedTask({
          title: preview.proposal.title,
          priority: preview.proposal.priority,
          due_date: preview.proposal.due_date,
          subtasks: preview.proposal.subtasks,
        });
        setDecomposedSubtasks(
          preview.proposal.subtasks.map((subtask) => ({ ...subtask, selected: true })),
        );
        setGenerationPreview(null);
        setParseFeedback(
          `${preview.proposal.subtasks.length} steps suggested. Choose and edit them before creating the task.`,
        );
        return;
      }
      const preview = await previewGeneratedTasks(naturalLanguageInput.trim());
      setGenerationPreview(preview);
      setDecompositionPreview(null);
      setDecomposedTask(null);
      setDecomposedSubtasks([]);
      onGenerated(preview);
    } catch (requestError) {
      setParseFeedback(getErrorMessage(requestError));
    } finally {
      setGenerationBusy(false);
    }
  }

  async function createDecomposedTask() {
    if (!decompositionPreview || !decomposedTask) return;
    const selectedSubtasks = decomposedSubtasks
      .filter((subtask) => subtask.selected)
      .map(({ client_id, title }) => ({ client_id, title: title.trim() }))
      .filter((subtask) => subtask.title);
    if (!decomposedTask.title.trim()) {
      setParseFeedback('The main task needs a title.');
      return;
    }
    if (selectedSubtasks.length === 0) {
      setParseFeedback('Select at least one subtask to create.');
      return;
    }
    setGenerationBusy(true);
    setParseFeedback(null);
    try {
      await confirmTaskDecomposition(decompositionPreview, {
        ...decomposedTask,
        title: decomposedTask.title.trim(),
        subtasks: selectedSubtasks,
      });
      onClose();
    } catch (requestError) {
      setParseFeedback(getErrorMessage(requestError));
    } finally {
      setGenerationBusy(false);
    }
  }

  return {
    naturalLanguageInput,
    setNaturalLanguageInput,
    aiEntryMode,
    parseFeedback,
    setParseFeedback,
    generationPreview,
    decompositionPreview,
    decomposedTask,
    setDecomposedTask,
    decomposedSubtasks,
    setDecomposedSubtasks,
    generationBusy,
    clearAiPreview,
    selectAiEntryMode,
    createFromNaturalLanguage,
    createDecomposedTask,
  };
}
