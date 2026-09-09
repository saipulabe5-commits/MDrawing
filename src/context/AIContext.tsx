import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { AIQuotaManager } from "../ai/AIQuotaManager";
import { AIClient } from "../ai/AIClient";
import { AIToolRouter } from "../ai/AIToolRouter";
import {
  AIQuotaState,
  StructuredAIResponse,
  AIToolExecutionRequest,
  AIToolExecutionResult,
} from "../ai/types";
import { AIProjectContextData } from "../ai/AIContextBuilder";
import { useAuth } from "./AuthContext";

interface PendingToolConfirmation {
  request: AIToolExecutionRequest;
  details: {
    actionTitle: string;
    actionDescription: string;
    impactSummary: string;
    parameters: Record<string, any>;
  };
}

interface AIContextValue {
  quotaState: AIQuotaState;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  isAnalyzing: boolean;
  lastResponse: StructuredAIResponse | null;
  conversationHistory: Array<{ prompt: string; response: StructuredAIResponse }>;
  pendingConfirmation: PendingToolConfirmation | null;
  executeCommand: (prompt: string, contextData?: AIProjectContextData) => Promise<StructuredAIResponse>;
  confirmPendingAction: () => Promise<AIToolExecutionResult | null>;
  cancelPendingAction: () => void;
  manualRetryQuota: () => boolean;
  clearConversation: () => void;
}

const AIContext = createContext<AIContextValue | undefined>(undefined);

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appUser } = useAuth();
  const quotaManager = useMemo(() => new AIQuotaManager(), []);
  const aiClient = useMemo(() => new AIClient(quotaManager), [quotaManager]);
  const toolRouter = useMemo(() => new AIToolRouter(), []);

  const [quotaState, setQuotaState] = useState<AIQuotaState>(quotaManager.getState());
  const [isOpen, setIsOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResponse, setLastResponse] = useState<StructuredAIResponse | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ prompt: string; response: StructuredAIResponse }>
  >([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingToolConfirmation | null>(null);

  // Subscribe to AIQuotaManager state changes
  useEffect(() => {
    const unsubscribe = quotaManager.subscribe((newState) => {
      setQuotaState(newState);
    });
    return () => unsubscribe();
  }, [quotaManager]);

  // Global Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const executeCommand = useCallback(
    async (prompt: string, contextData: AIProjectContextData = {}): Promise<StructuredAIResponse> => {
      setIsAnalyzing(true);
      try {
        const result = await aiClient.executeCommand(appUser, prompt, contextData);
        setLastResponse(result);
        setConversationHistory((prev) => [...prev, { prompt, response: result }]);
        return result;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [aiClient, appUser]
  );

  const confirmPendingAction = useCallback(async (): Promise<AIToolExecutionResult | null> => {
    if (!pendingConfirmation) return null;
    const req = { ...pendingConfirmation.request, confirmedByUser: true };
    const res = await toolRouter.executeTool(appUser, req, {});
    setPendingConfirmation(null);
    return res;
  }, [pendingConfirmation, toolRouter, appUser]);

  const cancelPendingAction = useCallback(() => {
    setPendingConfirmation(null);
  }, []);

  const manualRetryQuota = useCallback(() => {
    return quotaManager.manualRetry();
  }, [quotaManager]);

  const clearConversation = useCallback(() => {
    setLastResponse(null);
    setConversationHistory([]);
  }, []);

  const value = useMemo(
    () => ({
      quotaState,
      isOpen,
      setIsOpen,
      toggleOpen,
      isAnalyzing,
      lastResponse,
      conversationHistory,
      pendingConfirmation,
      executeCommand,
      confirmPendingAction,
      cancelPendingAction,
      manualRetryQuota,
      clearConversation,
    }),
    [
      quotaState,
      isOpen,
      toggleOpen,
      isAnalyzing,
      lastResponse,
      conversationHistory,
      pendingConfirmation,
      executeCommand,
      confirmPendingAction,
      cancelPendingAction,
      manualRetryQuota,
      clearConversation,
    ]
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};

export const useAI = (): AIContextValue => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAI must be used within an AIProvider");
  }
  return context;
};
