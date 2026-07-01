import React, { createContext, use, useState } from "react";

export type Model = {
  id: string;
  label: string;
  subtitle?: string;
};

export const DEFAULT_MODELS: readonly Model[] = [
  {
    id: "grok-4.5",
    label: "Grok 4.5",
    subtitle: "Most capable for ambitious work",
  },
  {
    id: "grok-build-0.1",
    label: "Grok Build 0.1",
    subtitle: "Fast model for agentic coding",
  },
];

type ModelContextValue = {
  models: readonly Model[];
  selectedModel: string;
  extendedThinking: boolean;
  setExtendedThinking: (value: boolean) => void;
};

const ModelContext = createContext<ModelContextValue | null>(null);

export function ModelProvider({
  children,
  models,
}: {
  children: React.ReactNode;
  models: readonly Model[];
}) {
  const [extendedThinking, setExtendedThinking] = useState(true);
  const selectedModel = "grok-4.5";

  return (
    <ModelContext
      value={{ models, selectedModel, extendedThinking, setExtendedThinking }}
    >
      {children}
    </ModelContext>
  );
}

export function useModel() {
  const context = use(ModelContext);
  if (!context) {
    throw new Error("useModel must be used within a ModelProvider");
  }
  return context;
}
