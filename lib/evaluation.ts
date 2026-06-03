export type ParamGroup = "audio" | "conversation" | "extraction" | "security";

export type ParamMeta = {
  value: string;
  label: string;
  group: ParamGroup;
  needsPrompt?: boolean;
  needsExtraction?: boolean;
};

// Mirrors EvaluationParameter in the Prodloop SDK (v0.1.8).
export const PARAMETERS: ParamMeta[] = [
  { value: "e2e_response_time", label: "E2E response time", group: "audio" },
  { value: "turn_by_turn_latency", label: "Turn-by-turn latency", group: "audio" },
  { value: "pause_profile", label: "Pause profile", group: "audio" },
  { value: "audio_artifacts", label: "Audio artifacts", group: "audio" },
  { value: "interruption_behavior", label: "Interruption behavior", group: "audio" },

  { value: "hallucination", label: "Hallucination", group: "conversation", needsPrompt: true },
  { value: "hallucination_fabrication", label: "Hallucination / fabrication", group: "conversation", needsPrompt: true },
  { value: "section_sequencing", label: "Section sequencing", group: "conversation", needsPrompt: true },
  { value: "mandatory_field_gating", label: "Mandatory field gating", group: "conversation", needsPrompt: true },
  { value: "interrupt_resume_precision", label: "Interrupt/resume precision", group: "conversation", needsPrompt: true },
  { value: "closing_verbatim_delivery", label: "Closing verbatim delivery", group: "conversation", needsPrompt: true },
  { value: "single_attempt_constraints", label: "Single-attempt constraints", group: "conversation", needsPrompt: true },
  { value: "info_dump_handling", label: "Info-dump handling", group: "conversation", needsPrompt: true },
  { value: "mid_flow_intent_switch", label: "Mid-flow intent switch", group: "conversation", needsPrompt: true },
  { value: "side_talk_leakage", label: "Side-talk leakage", group: "conversation", needsPrompt: true },
  { value: "ambiguous_partial_responses", label: "Ambiguous partial responses", group: "conversation", needsPrompt: true },
  { value: "internal_jargon_leakage", label: "Internal jargon leakage", group: "conversation", needsPrompt: true },
  { value: "context_memory_across_turns", label: "Context memory across turns", group: "conversation", needsPrompt: true },

  { value: "extraction_variables", label: "Extraction variables", group: "extraction", needsExtraction: true },
  { value: "identity_extraction", label: "Identity extraction", group: "extraction", needsPrompt: true },
  { value: "commitment_extraction", label: "Commitment extraction", group: "extraction", needsPrompt: true },

  { value: "prompt_injection", label: "Prompt injection", group: "security", needsPrompt: true },
  { value: "scope_boundary_testing", label: "Scope boundary testing", group: "security", needsPrompt: true },
  { value: "roleplay_jailbreak", label: "Roleplay jailbreak", group: "security", needsPrompt: true },
];

export const GROUP_LABELS: Record<ParamGroup, string> = {
  audio: "Audio & latency",
  conversation: "Conversation & prompt",
  extraction: "Extraction",
  security: "Security & robustness",
};

export const PARAM_BY_VALUE: Record<string, ParamMeta> = Object.fromEntries(
  PARAMETERS.map((p) => [p.value, p])
);

export function selectionNeedsPrompt(selected: string[]): boolean {
  return selected.some((v) => PARAM_BY_VALUE[v]?.needsPrompt);
}

export function selectionNeedsExtraction(selected: string[]): boolean {
  return selected.some((v) => PARAM_BY_VALUE[v]?.needsExtraction);
}
